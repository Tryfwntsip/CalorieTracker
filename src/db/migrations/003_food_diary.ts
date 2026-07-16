import type { Migration } from '@/db/migrations/types';

const releasedAt = '2026-07-16T00:00:00.000Z';

const foodDiarySql = `
CREATE TABLE meal_sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  name_el TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_meal_sections_position ON meal_sections(position);

INSERT INTO meal_sections (
  id, name, name_el, position, is_hidden, is_default, created_at, updated_at
) VALUES
  ('breakfast', 'Breakfast', 'Πρωινό', 0, 0, 1, '${releasedAt}', '${releasedAt}'),
  ('morning_snack', 'Morning snack', 'Πρωινό σνακ', 1, 0, 1, '${releasedAt}', '${releasedAt}'),
  ('lunch', 'Lunch', 'Μεσημεριανό', 2, 0, 1, '${releasedAt}', '${releasedAt}'),
  ('afternoon_snack', 'Afternoon snack', 'Απογευματινό σνακ', 3, 0, 1, '${releasedAt}', '${releasedAt}'),
  ('dinner', 'Dinner', 'Βραδινό', 4, 0, 1, '${releasedAt}', '${releasedAt}'),
  ('extra', 'Extra', 'Επιπλέον', 5, 1, 1, '${releasedAt}', '${releasedAt}');

ALTER TABLE diary_entries RENAME TO diary_entries_m2;

CREATE TABLE diary_entries (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL REFERENCES diary_days(date) ON DELETE CASCADE,
  section TEXT NOT NULL REFERENCES meal_sections(id) ON UPDATE CASCADE,
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

INSERT INTO diary_entries (
  id, day_date, section, food_id, custom_label, quantity, unit, grams_resolved,
  energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g, sodium_mg,
  micros_snapshot_json, logged_via, deleted_at, created_at, updated_at
)
SELECT
  id, day_date, section, food_id, custom_label, quantity, unit, grams_resolved,
  energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g, sodium_mg,
  micros_snapshot_json, logged_via, deleted_at, created_at, updated_at
FROM diary_entries_m2;

DROP TABLE diary_entries_m2;
CREATE INDEX idx_entries_day ON diary_entries(day_date);
CREATE INDEX idx_entries_day_section ON diary_entries(day_date, section);

CREATE TABLE exercise_logs (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (length(trim(activity_type)) > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'healthkit', 'health_connect')),
  external_uid TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (duration_minutes > 0 OR energy_kcal > 0)
);

CREATE INDEX idx_exercise_day ON exercise_logs(day_date);
CREATE UNIQUE INDEX idx_exercise_external_uid
  ON exercise_logs(origin, external_uid) WHERE external_uid IS NOT NULL;

CREATE TABLE steps_logs (
  id TEXT PRIMARY KEY,
  day_date TEXT NOT NULL,
  steps INTEGER NOT NULL CHECK (steps >= 0),
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'healthkit', 'health_connect')),
  external_uid TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(day_date, origin)
);

CREATE INDEX idx_steps_day ON steps_logs(day_date);
CREATE UNIQUE INDEX idx_steps_external_uid
  ON steps_logs(origin, external_uid) WHERE external_uid IS NOT NULL;
`;

export const foodDiaryMigration: Migration = {
  version: 3,
  name: 'food_diary',
  up: async (database) => {
    await database.execAsync(foodDiarySql);
  },
};
