# DATA_MODEL — CalorieTracker (working title)

Status: Phase 1. Tables are created incrementally by milestone (noted per table). All schema changes via `supabase/migrations/`. Mirrored subset lives in device SQLite (§7).

## 1. Conventions

- Postgres, `public` schema. Ids: **UUIDv7 generated client-side** for user-log tables (offline-first requirement), `gen_random_uuid()` default otherwise.
- Every table: `created_at timestamptz default now()`, `updated_at timestamptz` (trigger-maintained). User-log tables add `deleted_at timestamptz` (tombstone) — the app filters `deleted_at is null`.
- Every user-owned table has `user_id uuid not null references auth.users(id) on delete cascade` and RLS (§6).
- Enums as Postgres enums; diary dates as `date` (user-local calendar date); quantities metric; energy kcal; mass g; volume ml.
- Nutrient columns are `numeric` per **100 g/ml**; per-portion values always derived.

## 2. Identity, profile, goals (M2, M4)

**profiles** — 1:1 with auth.users
`user_id PK`, `display_name`, `date_of_birth date`, `sex sex_enum('male','female','unspecified')`, `height_cm numeric`, `locale text('en','el')`, `theme text('system','light','dark')`, `onboarding_completed_at timestamptz`

**user_settings** — 1:1
`user_id PK`, `water_goal_ml int`, `water_quick_add_ml int[]`, `week_starts_on int`, `diary_section_order jsonb`, `unit_system text default 'metric'`

**goals** — versioned goal history; the active goal = latest `effective_from <= today`
`id PK`, `user_id`, `goal_type enum('lose','maintain','gain','build_muscle')`, `activity_level enum(5)`, `start_weight_kg`, `goal_weight_kg`, `weekly_rate_kg numeric`, `calorie_target int`, `protein_g int`, `carbs_g int`, `fat_g int`, `weekday_calorie_overrides jsonb` (e.g. `{"1":2200}`), `dietary_preference enum`, `effective_from date`, `is_aggressive_confirmed bool`
Index: `(user_id, effective_from desc)`

**user_allergies**
`id PK`, `user_id`, `allergen allergen_enum` (gluten, crustaceans, egg, fish, peanut, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs), `custom_text text null`

## 3. Foods & provenance (M5, M6)

**foods** — shared catalog (global rows + user rows)
`id PK`, `owner_user_id uuid null` (null = global/catalog row; non-null = custom food), `name text`, `name_el text null`, `brand text null`, `barcode text null (indexed)`, `source food_source_enum('off','usda','greek_db','user','ai_estimate')`, `external_id text null`, `source_updated_at timestamptz null`, `quality food_quality_enum('verified','complete','partial','user_entered')`, `nova_class smallint null`, `serving_name text null`, `serving_grams numeric null`, `is_liquid bool`, nutrient columns (§4), `micros jsonb` (§4), `search_tsv tsvector` (name+brand, both langs)
Unique: `(source, external_id)` where external_id not null. RLS: global rows readable by all authenticated; user rows only by owner (§6).

**food_portions** — provider/user-defined portions per food
`id PK`, `food_id FK`, `label text` ("1 slice"), `label_el text null`, `grams numeric`

**food_overrides** — user corrections; original food row untouched
`id PK`, `user_id`, `food_id FK`, overridden nutrient columns (all nullable), `note text`
Resolution: app applies override on top of food for that user; provenance UI shows both.

**user_food_favorites** `(user_id, food_id) PK`, `created_at`
**user_food_recents** `(user_id, food_id) PK`, `last_used_at`, `use_count int`

**meal_templates** ("My meals") + **meal_template_items**
templates: `id PK`, `user_id`, `name`; items: `id PK`, `template_id FK`, `food_id FK`, `quantity numeric`, `unit portion_unit_enum('g','ml','serving','piece','tsp','tbsp')`, `grams_resolved numeric`

## 4. Canonical nutrient model

Fixed columns on `foods` (per 100 g/ml, `numeric`, nullable — null = unknown, never 0):
`energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, mono_fat_g, poly_fat_g, fiber_g, sugar_g, salt_g, sodium_mg, cholesterol_mg`

`micros jsonb` — flat object with **only** canonical keys (Zod-enforced, unit in key name):
`vit_a_ug, vit_c_mg, vit_d_ug, vit_e_mg, vit_k_ug, thiamin_mg, riboflavin_mg, niacin_mg, vit_b6_mg, folate_ug, vit_b12_ug, calcium_mg, iron_mg, magnesium_mg, potassium_mg, zinc_mg, phosphorus_mg, selenium_ug, iodine_ug`

Rationale: hot macro fields are typed/indexed columns; long-tail micros stay schemaless-but-validated. Provider→canonical mapping tables live in `docs/API_AND_DATA_SOURCES.md` and `supabase/functions/food-gateway/mappings/`.

## 5. Diary & logs (M3, M7, M10) — all local-first (UUIDv7, tombstones, outbox-synced)

**diary_meal_sections** — per-user section config
`id PK`, `user_id`, `kind enum('breakfast','morning_snack','lunch','afternoon_snack','dinner','custom')`, `custom_name text null`, `sort_order int`, `is_hidden bool`

**diary_entries** — one logged food/meal line
`id PK (uuidv7)`, `user_id`, `entry_date date`, `section_id FK`, `food_id FK null`, `template_id FK null`, `custom_label text null` (manual quick-entry), `quantity numeric`, `unit portion_unit_enum`, `grams_resolved numeric null`, **nutrient snapshot columns** (same set as §4 macros + `micros_snapshot jsonb`) — frozen at log time, `logged_via enum('search','barcode','recent','favorite','template','manual','photo','plan')`
Index: `(user_id, entry_date)`

**water_logs** `id PK`, `user_id`, `entry_date`, `amount_ml int`, `logged_at timestamptz`
**weight_logs** `id PK`, `user_id`, `entry_date unique(user_id,entry_date)`, `weight_kg numeric`, `origin enum('manual','healthkit','health_connect')`, `external_uid text null`
**mood_logs** `id PK`, `user_id`, `entry_date unique(user_id,entry_date)`, `mood smallint 1..5`, `tags text[]`, `note text`
**diary_notes** `id PK`, `user_id`, `entry_date unique(user_id,entry_date)`, `body text`
**exercise_logs** `id PK`, `user_id`, `entry_date`, `name`, `duration_min`, `energy_kcal`, `origin`, `external_uid text null`, `started_at timestamptz null`, `ended_at timestamptz null`
**steps_logs** `id PK`, `user_id`, `entry_date`, `steps int`, `origin`, `external_uid text null`
Dedup rule (F10): unique `(user_id, origin, external_uid)` where external_uid not null; daily steps total = max(health origin) else manual; overlapping workouts by time-range collapse to health-platform record.

## 6. Recipes, planning, groceries (M8, M9)

**recipes** `id PK`, `owner_user_id null (null = seeded catalog)`, `title`, `title_el null`, `servings numeric`, `prep_min int`, `cook_min int`, `instructions jsonb` (ordered steps, per-locale), `image_path text null`, `tags text[]`, `allergens allergen_enum[]`, `is_published bool` (catalog only)
**recipe_ingredients** `id PK`, `recipe_id FK`, `food_id FK`, `quantity`, `unit`, `grams_resolved`, `note null`
**user_recipe_favorites** `(user_id, recipe_id) PK`

**meal_plans** `id PK`, `user_id`, `week_start date`, unique `(user_id, week_start)`
**meal_plan_entries** `id PK`, `plan_id FK`, `plan_date date`, `section_kind`, `recipe_id null | food_id null | template_id null` (exactly one set — check constraint), `servings numeric`, `added_to_diary_entry_id uuid null`

**grocery_lists** `id PK`, `user_id`, `name`, `source_plan_id null`
**grocery_items** `id PK`, `list_id FK`, `label`, `food_id null`, `quantity numeric null`, `unit text null`, `is_checked bool`, `sort_order int`
Combining rule: items from same `food_id` + compatible unit sum quantities; else grouped by normalized label.

## 7. Fasting (M10)

**fasting_plans** `id PK`, `user_id`, `kind enum('12_12','14_10','16_8','18_6','20_4','5_2','adf','custom')`, `eating_window jsonb` (per-weekday windows for custom), `is_active bool`
**fasting_sessions** `id PK (uuidv7)`, `user_id`, `plan_id null`, `started_at timestamptz`, `ended_at timestamptz null`, `target_hours numeric`, `note text`, `completed bool generated/derived`
Streak = computed in domain layer, not stored.

## 8. AI photo analysis (M12)

**photo_analyses** `id PK`, `user_id`, `status enum('pending','done','failed')`, `image_path text null` (null unless retention consent), `provider text`, `model text`, `overall_confidence numeric`, `result jsonb` (Zod-shaped detected items), `confirmed_diary_entry_ids uuid[]`, `created_at`
Storage: bucket `meal-photos`, path `user_id/...`, private, RLS storage policies; auto-purge job for non-consented images (belt & braces — function already deletes).

## 9. Privacy, consent, audit (M2 baseline, M13)

**consents** `id PK`, `user_id`, `kind enum('analytics','ai_photo','ai_image_retention','health_steps','health_workouts','health_weight')`, `granted bool`, `version text` (policy version), `changed_at timestamptz` — append-only (new row per change; latest wins)

**audit_events** — security-relevant events, append-only, **no service-role reads from client**
`id PK`, `user_id`, `event enum('signup','login','password_reset','export_requested','export_delivered','deletion_requested','account_deleted','consent_changed')`, `metadata jsonb` (no sensitive payloads), `created_at`

**export_jobs** `id PK`, `user_id`, `status`, `bundle_path null`, `expires_at`

**notification_prefs** `id PK`, `user_id`, `kind enum('meal','water','weigh_in','fasting_start','fasting_end','goal_review','incomplete_diary')`, `enabled bool`, `config jsonb` (times/days/intervals), unique `(user_id, kind)`

## 10. RLS policy pattern

Default deny; enable RLS on every table in its creation migration.

- User-owned tables: `using (user_id = auth.uid())` for select/update/delete, `with check (user_id = auth.uid())` for insert/update — via a reusable `is_owner(user_id)` helper.
- `foods`/`recipes` catalogs: select where `owner_user_id is null or owner_user_id = auth.uid()`; insert/update/delete only own rows (`owner_user_id = auth.uid()`). Global rows maintained only by migrations/Edge Functions (service role).
- `audit_events`: insert via functions only; select own rows.
- Storage: per-user prefix policies on `meal-photos`, `exports`, `recipe-images`.
- Every migration adding a table ships an RLS test in `supabase/tests/` (cross-user access must fail).

## 11. Device SQLite mirror

Tables mirrored 1:1 (subset of columns) for offline: `diary_entries, water_logs, weight_logs, mood_logs, diary_notes, exercise_logs, steps_logs, fasting_sessions, diary_meal_sections, meal_templates(+items), food_cache` (snapshot of any food seen), plus `outbox` and `sync_state (table_name, last_pulled_at)`. Migrations for SQLite are versioned in `src/lib/sqlite/migrations.ts` with tests.

## 12. Aggregation for analytics (M7, M11)

Daily rollup view (or per-user materialized table refreshed on sync) `daily_summary`: date, kcal_in, kcal_out, macros, water_ml, steps, exercise_min, weight_kg, mood, fasting_hours, target_kcal — powers charts without shipping raw rows; 2-year queries stay cheap. Exact mechanism finalized in M7 with measurements.
