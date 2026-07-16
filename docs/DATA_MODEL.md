# DATA_MODEL — CalorieTracker (working title)

Status: revised 2026-07-16 — **SQLite is the primary and authoritative database** (no Postgres, no Supabase, no RLS — single-user device data). Schema changes happen **only** via versioned migrations (`src/db/migrations/`, PRAGMA `user_version`). Tables are introduced per milestone as noted.

## 1. Conventions

- SQLite with `PRAGMA foreign_keys = ON` (verified in tests) and WAL mode.
- IDs: `TEXT` UUIDv7 generated in-app (sortable by creation time).
- Timestamps: `created_at` / `updated_at` as ISO-8601 UTC `TEXT`, maintained by the repository layer on every insert/update.
- Diary dates: local calendar day `TEXT 'YYYY-MM-DD'` (see `src/domain/dates`).
- Soft deletes only where undo/history requires it (`deleted_at TEXT NULL` on diary_entries); everything else hard-deletes.
- Nutrients: `REAL` per **100 g/ml**; `NULL` = unknown (never 0). Energy kcal, mass g, volume ml — metric only.
- Enums are `TEXT` with `CHECK (col IN (...))` constraints, mirrored by Zod schemas in `src/schemas/`.
- Every table is created inside a migration that also creates its indexes.

## 2. M2 schema — core tables

**profile** — exactly one row (`CHECK (id = 1)`)

```
id INTEGER PK CHECK(id=1), date_of_birth TEXT NULL ('YYYY-MM-DD'),
sex TEXT CHECK(sex IN ('male','female','unspecified')) DEFAULT 'unspecified',
height_cm REAL NULL, current_weight_kg REAL NULL, target_weight_kg REAL NULL,
activity_level INTEGER NULL CHECK(activity_level BETWEEN 1 AND 5),
goal_type TEXT NULL CHECK(goal_type IN ('lose','maintain','gain','build_muscle')),
weekly_rate_kg REAL NULL,
calorie_target INTEGER NULL, protein_target_g INTEGER NULL,
carbs_target_g INTEGER NULL, fat_target_g INTEGER NULL,
created_at TEXT, updated_at TEXT
```

Age is derived from `date_of_birth` (stays correct over time). `current_weight_kg` mirrors the latest weight_record (repository keeps it in sync). M4 weekday calorie overrides use `settings.weekday_calorie_overrides` JSON keyed by weekday `0` (Sunday) through `6` (Saturday).

`weekly_rate_kg` is signed internally: negative for loss, positive for gain/build-muscle, and zero for maintenance. The UI accepts a positive pace and derives the sign from `goal_type`.

**profile_goal_history** — M3 append-only target versions

```
version INTEGER PK AUTOINCREMENT,
profile_id INTEGER NOT NULL CHECK(profile_id=1)
  REFERENCES profile(id) ON DELETE CASCADE,
effective_at TEXT NOT NULL,
goal_type TEXT NULL, weekly_rate_kg REAL NULL,
current_weight_kg REAL NULL, target_weight_kg REAL NULL,
activity_level INTEGER NULL,
calorie_target INTEGER NULL, protein_target_g INTEGER NULL,
carbs_target_g INTEGER NULL, fat_target_g INTEGER NULL,
created_at TEXT NOT NULL
INDEX idx_profile_goal_history_effective
  ON profile_goal_history(effective_at, version)
```

The M3 migration snapshots an existing M2 profile on upgrade. Profile create/update and history append occur in one transaction; deleting the singleton profile cascades its history.

**settings** — exactly one row (`CHECK (id = 1)`)

```
id INTEGER PK CHECK(id=1),
language TEXT CHECK(language IN ('en','el')) DEFAULT 'en',
theme TEXT CHECK(theme IN ('system','light','dark')) DEFAULT 'system',
unit_system TEXT CHECK(unit_system IN ('metric')) DEFAULT 'metric',
water_goal_ml INTEGER DEFAULT 2000, week_starts_on INTEGER DEFAULT 1,
diary_section_order TEXT NULL (JSON), weekday_calorie_overrides TEXT NULL (JSON),
created_at TEXT, updated_at TEXT
```

Theme and language are authoritative here. AsyncStorage retains only a synchronized startup cache so the saved appearance can render before SQLite opens.

**foods**

```
id TEXT PK, name TEXT NOT NULL, name_el TEXT NULL, brand TEXT NULL,
barcode TEXT NULL, source TEXT CHECK(source IN ('user','greek_seed','off')) NOT NULL,
external_id TEXT NULL, source_updated_at TEXT NULL,
quality TEXT CHECK(quality IN ('verified','complete','partial','user_entered')) NOT NULL,
nova_class INTEGER NULL, is_liquid INTEGER NOT NULL DEFAULT 0,
serving_name TEXT NULL, serving_grams REAL NULL,
energy_kcal REAL NULL, protein_g REAL NULL, carbs_g REAL NULL, fat_g REAL NULL,
sat_fat_g REAL NULL, mono_fat_g REAL NULL, poly_fat_g REAL NULL,
fiber_g REAL NULL, sugar_g REAL NULL, salt_g REAL NULL, sodium_mg REAL NULL,
cholesterol_mg REAL NULL, micros_json TEXT NULL (JSON, canonical keys — §9),
created_at TEXT, updated_at TEXT
UNIQUE(source, external_id) WHERE external_id IS NOT NULL
INDEX idx_foods_barcode ON foods(barcode)
INDEX idx_foods_name / idx_foods_name_el (accent-insensitive search strategy finalized in M5)
```

**food_portions**

```
id TEXT PK, food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
label TEXT NOT NULL, label_el TEXT NULL, grams REAL NOT NULL
INDEX idx_portions_food ON food_portions(food_id)
```

**diary_days** — one row per calendar day that has any content

```
date TEXT PK ('YYYY-MM-DD'), mood INTEGER NULL CHECK(mood BETWEEN 1 AND 5),
note TEXT NULL, created_at TEXT, updated_at TEXT
```

**diary_entries**

```
id TEXT PK, day_date TEXT NOT NULL REFERENCES diary_days(date) ON DELETE CASCADE,
  section TEXT NOT NULL REFERENCES meal_sections(id) ON UPDATE CASCADE,
food_id TEXT NULL REFERENCES foods(id) ON DELETE SET NULL,
custom_label TEXT NULL,           -- manual quick-entry
quantity REAL NOT NULL, unit TEXT NOT NULL CHECK(unit IN ('g','ml','serving','piece','tsp','tbsp')),
grams_resolved REAL NULL,
-- nutrient snapshot, frozen at log time (food edits never rewrite history):
energy_kcal REAL NULL, protein_g REAL NULL, carbs_g REAL NULL, fat_g REAL NULL,
sat_fat_g REAL NULL, fiber_g REAL NULL, sugar_g REAL NULL, sodium_mg REAL NULL,
micros_snapshot_json TEXT NULL,
logged_via TEXT NOT NULL CHECK(logged_via IN ('search','barcode','recent','favorite','template','manual','photo','plan')),
deleted_at TEXT NULL,             -- tombstone for undo window
created_at TEXT, updated_at TEXT
INDEX idx_entries_day ON diary_entries(day_date)
```

**weight_records**

```
id TEXT PK, day_date TEXT NOT NULL UNIQUE, weight_kg REAL NOT NULL,
origin TEXT NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','healthkit','health_connect')),
external_uid TEXT NULL, created_at TEXT, updated_at TEXT
```

**water_records**

```
id TEXT PK, day_date TEXT NOT NULL, amount_ml INTEGER NOT NULL CHECK(amount_ml > 0),
logged_at TEXT NOT NULL, created_at TEXT
INDEX idx_water_day ON water_records(day_date)
```

**scanned_products** — normalized cache of external barcode lookups

```
barcode TEXT PK, food_id TEXT NULL REFERENCES foods(id) ON DELETE SET NULL,
source TEXT NOT NULL CHECK(source IN ('off')), raw_payload_json TEXT NULL,
fetched_at TEXT NOT NULL, created_at TEXT, updated_at TEXT
```

M6 stores the canonical checksum-validated GTIN-13 as `barcode`. A successful OFF lookup writes the normalized food and a sanitized provider payload; local lookup never needs the payload. The existing M2 schema is sufficient, so M6 adds no migration.

**barcode_scan_history**

```
id TEXT PK, barcode TEXT NOT NULL,
status TEXT NOT NULL CHECK(status IN ('found_local','found_online','not_found','offline')),
resolved_food_id TEXT NULL REFERENCES foods(id) ON DELETE SET NULL,
scanned_at TEXT NOT NULL
INDEX idx_scan_history_time ON barcode_scan_history(scanned_at)
```

M6 writes one row for every lookup attempt. Provider/network failures use `offline`; the user-facing result can retain a more specific typed provider error while the stable persisted status remains within this four-value set.

Note: `weight_records`/`water_records` reference `day_date` **without** an FK to diary_days (a weigh-in shouldn't require creating a diary day); diary_entries do require the day row (repository creates it on first write).

## 3. M4 diary tables

**meal_sections** — ordered, localized, customizable meal slots

```
id TEXT PK, name TEXT NOT NULL, name_el TEXT NULL,
position INTEGER NOT NULL UNIQUE, is_hidden INTEGER NOT NULL DEFAULT 0,
is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT
```

The six stable defaults are `breakfast`, `morning_snack`, `lunch`, `afternoon_snack`, `dinner`, and hidden `extra`. Custom rows use UUIDv7 IDs. Existing diary entries are preserved by migration 003 when the original fixed section constraint is replaced with this foreign key.

**exercise_logs**

```
id TEXT PK, day_date TEXT NOT NULL, activity_type TEXT NOT NULL,
duration_minutes INTEGER NOT NULL, energy_kcal REAL NOT NULL,
origin TEXT CHECK(origin IN ('manual','healthkit','health_connect')),
external_uid TEXT NULL, created_at TEXT, updated_at TEXT
INDEX idx_exercise_day ON exercise_logs(day_date)
UNIQUE(origin, external_uid) WHERE external_uid IS NOT NULL
```

At least duration or energy must be greater than zero.

**steps_logs**

```
id TEXT PK, day_date TEXT NOT NULL, steps INTEGER NOT NULL,
origin TEXT CHECK(origin IN ('manual','healthkit','health_connect')),
external_uid TEXT NULL, created_at TEXT, updated_at TEXT,
UNIQUE(day_date, origin)
INDEX idx_steps_day ON steps_logs(day_date)
UNIQUE(origin, external_uid) WHERE external_uid IS NOT NULL
```

## 4. M5 food catalog tables

Migration 004 adds `search_name` and `search_name_el` to `foods`. Repositories maintain both as lowercase, accent-stripped keys (including normalized Greek final sigma). They are implementation columns and never replace the displayed source names.

**food_overrides** — user corrections without rewriting source data

```
food_id TEXT PK REFERENCES foods(id) ON DELETE CASCADE,
name TEXT, name_el TEXT, search_name TEXT, search_name_el TEXT,
energy_kcal REAL NULL, protein_g REAL NULL, carbs_g REAL NULL, fat_g REAL NULL,
sat_fat_g REAL NULL, fiber_g REAL NULL, sugar_g REAL NULL,
salt_g REAL NULL, sodium_mg REAL NULL, updated_at TEXT
```

**food_favorites / food_recents**

```
food_favorites(food_id TEXT PK REFERENCES foods(id) ON DELETE CASCADE, created_at TEXT)
food_recents(food_id TEXT PK REFERENCES foods(id) ON DELETE CASCADE,
             last_used_at TEXT, use_count INTEGER)
```

**meal_templates / meal_template_items**

```
meal_templates(id TEXT PK, name TEXT, created_at TEXT, updated_at TEXT)
meal_template_items(
  id TEXT PK, template_id TEXT REFERENCES meal_templates(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE CASCADE,
  grams REAL, position INTEGER, created_at TEXT, UNIQUE(template_id, position)
)
```

The production part of migration 004 inserts 150 original bilingual Greek/common foods and one provider-defined portion for each. It is idempotent by stable IDs/external IDs and is separate from the optional development demo diary seed.

## 5. M8 recipe and grocery tables

Migration 005 adds:

**recipes / recipe_ingredients / recipe_favorites**

```
recipes(
  id TEXT PK, title TEXT, title_el TEXT NULL, servings REAL,
  prep_minutes INTEGER, cook_minutes INTEGER,
  instructions_json TEXT, instructions_el_json TEXT NULL,
  dietary_tags_json TEXT, allergen_tags_json TEXT,
  source TEXT CHECK(source IN ('user','seed')),
  created_at TEXT, updated_at TEXT
)
recipe_ingredients(
  id TEXT PK, recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT NULL REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT, quantity REAL, unit TEXT CHECK(unit IN ('g','ml','piece')),
  grams_resolved REAL NULL, position INTEGER, created_at TEXT,
  UNIQUE(recipe_id, position)
)
recipe_favorites(
  recipe_id TEXT PK REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TEXT
)
```

Ingredient labels survive deletion of a referenced user food. Per-serving
nutrition is calculated from the current validated food nutrients and
`grams_resolved`; if required nutrient data or a conversion is missing, the
result remains unknown rather than silently becoming zero. Migration 005 ships
25 original bilingual recipes linked to the production food catalog.

**grocery_lists / grocery_items**

```
grocery_lists(id TEXT PK, name TEXT, created_at TEXT, updated_at TEXT)
grocery_items(
  id TEXT PK, list_id TEXT REFERENCES grocery_lists(id) ON DELETE CASCADE,
  food_id TEXT NULL REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT, quantity REAL, unit TEXT CHECK(unit IN ('g','ml','piece')),
  grams_resolved REAL NULL, is_checked INTEGER, position INTEGER,
  created_at TEXT, updated_at TEXT
)
```

Recipe ingredients with the same food and unit are summed. Different units are
combined into grams only when both have a resolved gram amount. Manual items
merge by an accent-insensitive normalized label; otherwise they remain separate.
Checked state is preserved only when every merged source row was checked.

## 6. M9 weekly meal planning

Migration 006 adds one plan root per Monday-keyed week and XOR-validated entries:

```
meal_plans(
  id TEXT PK, week_start TEXT UNIQUE,
  created_at TEXT, updated_at TEXT
)
meal_plan_entries(
  id TEXT PK,
  plan_id TEXT REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_date TEXT, section TEXT REFERENCES meal_sections(id) ON UPDATE CASCADE,
  recipe_id TEXT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT NULL REFERENCES foods(id) ON DELETE CASCADE,
  template_id TEXT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  quantity REAL, position INTEGER, created_at TEXT, updated_at TEXT,
  CHECK(exactly one of recipe_id, food_id, template_id is non-NULL),
  UNIQUE(plan_id, day_date, section, position)
)
```

The app uses Monday as the stable local week key. A slot can contain a recipe
(quantity in servings), a food (quantity in grams), or a “My meal” template
(quantity as a multiplier). Logging snapshots the current nutrients into normal
diary entries. Grocery generation expands every source, scales it to the planned
quantity, and applies the M8 unit-aware combining rules. Copy week replaces the
target week's entries transactionally, so a partial copy cannot be observed.

## 7. M10 fasting and mood

Migration 007 adds persistent fasting configuration and history:

```
fasting_plans(
  id TEXT PK, kind TEXT, name TEXT,
  fasting_minutes INTEGER, eating_minutes INTEGER, start_time TEXT,
  fasting_weekdays_json TEXT, reduced_target_percent INTEGER,
  notifications_enabled INTEGER, is_active INTEGER,
  created_at TEXT, updated_at TEXT
)
fasting_sessions(
  id TEXT PK, plan_id TEXT NULL REFERENCES fasting_plans(id) ON DELETE SET NULL,
  started_at TEXT, target_end_at TEXT, ended_at TEXT NULL,
  status TEXT, note TEXT NULL,
  start_notification_id TEXT NULL, end_notification_id TEXT NULL,
  created_at TEXT, updated_at TEXT
)
mood_tags(
  id TEXT PK, name TEXT, name_el TEXT, position INTEGER,
  created_at TEXT, updated_at TEXT
)
diary_day_mood_tags(
  day_date TEXT REFERENCES diary_days(date) ON DELETE CASCADE,
  tag_id TEXT REFERENCES mood_tags(id) ON DELETE CASCADE,
  created_at TEXT, PK(day_date, tag_id)
)
```

Partial unique indexes permit only one active plan and one active session. Session timestamps
are absolute ISO-8601 instants, so elapsed duration stays correct through midnight and DST.
The plan's usual local start time is configuration, not an elapsed-time clock. 5:2 stores
exactly two selected weekdays; alternate-day behavior is deterministic from the local day key.
Reduced calorie targets are calculated in the domain layer and clamped to the existing 1,200
kcal safety floor. Mood tags are a fixed, original bilingual vocabulary; the join table permits
multiple tags per diary day without changing the existing 1–5 mood score.

## 8. Later-milestone tables (introduced by their own migrations)

- **M12 (optional):** `photo_analyses` (result JSON, confidence, confirmed entry ids; image kept only with opt-in).

Column shapes follow the same conventions; each lands with its milestone and its own migration + tests.

## 9. Migration discipline

- `src/db/migrations/index.ts` exports the ordered list; the runner (`src/db/migrate.ts`) wraps each pending migration in a transaction, applies in order, sets `PRAGMA user_version = n`.
- A failing migration rolls back, leaves the previous `user_version`, and surfaces a typed error (tested).
- Destructive column changes use the SQLite table-rebuild recipe (new table → copy → drop → rename) inside one transaction.
- Tests cover: fresh install → latest; every stepwise upgrade path from each released version; idempotent re-run.

## 10. Canonical nutrient model

Unchanged in spirit from the original design: fixed macro columns + `micros_json` restricted to canonical keys (`vit_a_ug, vit_c_mg, vit_d_ug, vit_e_mg, vit_k_ug, thiamin_mg, riboflavin_mg, niacin_mg, vit_b6_mg, folate_ug, vit_b12_ug, calcium_mg, iron_mg, magnesium_mg, potassium_mg, zinc_mg, phosphorus_mg, selenium_ug, iodine_ug`), Zod-enforced (`src/domain/schemas/nutrients.ts`). Missing = `NULL`/absent, never 0. Provider mappings (OFF → canonical) live with the OFF adapter and are fixture-tested.

## 11. Seed data

- **Dev-only** (`src/db/seed/dev.ts`): a small set of original Greek example foods with portions + one demo diary day; runs only in `__DEV__`, only when all relevant tables are empty, and is idempotent.
- **Production catalog** (M5+): curated Greek foods and 25 bilingual M8 recipes shipped as versioned seed migrations (originally authored; no scraped/proprietary data).

## 12. Aggregation for analytics (M7)

Daily SQL aggregates over `diary_entries`, `water_records`, and `steps_logs`, plus the
already-daily `weight_records`, power charts. Queries stay in
`progressRepository`; soft-deleted diary entries are excluded and multiple
whole-day step origins use `MAX`, not a sum that could double-count steps.
Historical calorie targets are resolved from `profile_goal_history` inside the
nutrition query, then weekday overrides are applied by the pure progress domain
calculation. The UI requests only the selected bounded range (maximum 730 days),
so raw diary/water/steps event rows are never fanned out to JavaScript.

Mood score points and tag-frequency summaries are also aggregated in SQLite for the selected
progress range; the UI never scans diary-day rows to produce these trends.

## 13. Implementation decisions

- SQLite cannot express strict ISO-8601 or real-calendar validation cleanly with portable `CHECK` syntax, so date/timestamp shape is enforced by Zod on every repository read; enum, range, uniqueness, and relationship rules remain database constraints.
- `food_portions` are deleted with their food (`CASCADE`). Historical diary entries and cached scan records keep their event rows when a food is removed, but their food reference becomes `NULL` (`SET NULL`). Deleting a diary day deletes its entries (`CASCADE`).
- `food_portions` and append-style scan/water records follow the timestamp columns in §2; mutable aggregate roots maintain both timestamps through repositories. This avoids undocumented columns in the first released schema.
- Diary entry tombstones power the six-second undo window. Water and activity undo recreates the deleted validated record snapshot; meal-section rows cannot be deleted while entries reference them.
