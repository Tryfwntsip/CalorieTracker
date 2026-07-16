import type { Migration } from '@/db/migrations/types';

const schemaSql = `
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  date_of_birth TEXT,
  sex TEXT NOT NULL DEFAULT 'unspecified'
    CHECK (sex IN ('male', 'female', 'unspecified')),
  height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
  current_weight_kg REAL CHECK (current_weight_kg IS NULL OR current_weight_kg > 0),
  target_weight_kg REAL CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
  activity_level INTEGER CHECK (activity_level IS NULL OR activity_level BETWEEN 1 AND 5),
  goal_type TEXT CHECK (
    goal_type IS NULL OR goal_type IN ('lose', 'maintain', 'gain', 'build_muscle')
  ),
  weekly_rate_kg REAL,
  calorie_target INTEGER CHECK (calorie_target IS NULL OR calorie_target > 0),
  protein_target_g INTEGER CHECK (protein_target_g IS NULL OR protein_target_g >= 0),
  carbs_target_g INTEGER CHECK (carbs_target_g IS NULL OR carbs_target_g >= 0),
  fat_target_g INTEGER CHECK (fat_target_g IS NULL OR fat_target_g >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'el')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  unit_system TEXT NOT NULL DEFAULT 'metric' CHECK (unit_system = 'metric'),
  water_goal_ml INTEGER NOT NULL DEFAULT 2000 CHECK (water_goal_ml > 0),
  week_starts_on INTEGER NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  diary_section_order TEXT,
  weekday_calorie_overrides TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE foods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  name_el TEXT,
  brand TEXT,
  barcode TEXT,
  source TEXT NOT NULL CHECK (source IN ('user', 'greek_seed', 'off')),
  external_id TEXT,
  source_updated_at TEXT,
  quality TEXT NOT NULL
    CHECK (quality IN ('verified', 'complete', 'partial', 'user_entered')),
  nova_class INTEGER CHECK (nova_class IS NULL OR nova_class BETWEEN 1 AND 4),
  is_liquid INTEGER NOT NULL DEFAULT 0 CHECK (is_liquid IN (0, 1)),
  serving_name TEXT,
  serving_grams REAL CHECK (serving_grams IS NULL OR serving_grams > 0),
  energy_kcal REAL CHECK (energy_kcal IS NULL OR energy_kcal >= 0),
  protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  sat_fat_g REAL CHECK (sat_fat_g IS NULL OR sat_fat_g >= 0),
  mono_fat_g REAL CHECK (mono_fat_g IS NULL OR mono_fat_g >= 0),
  poly_fat_g REAL CHECK (poly_fat_g IS NULL OR poly_fat_g >= 0),
  fiber_g REAL CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sugar_g REAL CHECK (sugar_g IS NULL OR sugar_g >= 0),
  salt_g REAL CHECK (salt_g IS NULL OR salt_g >= 0),
  sodium_mg REAL CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  cholesterol_mg REAL CHECK (cholesterol_mg IS NULL OR cholesterol_mg >= 0),
  micros_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_foods_source_external_id
  ON foods(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_foods_barcode ON foods(barcode);
CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_name_el ON foods(name_el);

CREATE TABLE food_portions (
  id TEXT PRIMARY KEY,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  label_el TEXT,
  grams REAL NOT NULL CHECK (grams > 0)
);

CREATE INDEX idx_portions_food ON food_portions(food_id);

CREATE TABLE diary_days (
  date TEXT PRIMARY KEY,
  mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE diary_entries (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL REFERENCES diary_days(date) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (
    section IN (
      'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra'
    )
  ),
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  custom_label TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'serving', 'piece', 'tsp', 'tbsp')),
  grams_resolved REAL CHECK (grams_resolved IS NULL OR grams_resolved >= 0),
  energy_kcal REAL CHECK (energy_kcal IS NULL OR energy_kcal >= 0),
  protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  sat_fat_g REAL CHECK (sat_fat_g IS NULL OR sat_fat_g >= 0),
  fiber_g REAL CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sugar_g REAL CHECK (sugar_g IS NULL OR sugar_g >= 0),
  sodium_mg REAL CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  micros_snapshot_json TEXT,
  logged_via TEXT NOT NULL CHECK (
    logged_via IN (
      'search', 'barcode', 'recent', 'favorite', 'template', 'manual', 'photo', 'plan'
    )
  ),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (food_id IS NOT NULL OR length(trim(custom_label)) > 0)
);

CREATE INDEX idx_entries_day ON diary_entries(day_date);

CREATE TABLE weight_records (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0),
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'healthkit', 'health_connect')),
  external_uid TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE water_records (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  logged_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_water_day ON water_records(day_date);

CREATE TABLE scanned_products (
  barcode TEXT PRIMARY KEY,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source = 'off'),
  raw_payload_json TEXT,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE barcode_scan_history (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('found_local', 'found_online', 'not_found', 'offline')),
  resolved_food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  scanned_at TEXT NOT NULL
);

CREATE INDEX idx_scan_history_time ON barcode_scan_history(scanned_at);
`;

export const coreSchemaMigration: Migration = {
  version: 1,
  name: 'core_schema',
  up: async (database) => {
    await database.execAsync(schemaSql);
  },
};
