import type { Migration } from '@/db/migrations/types';

const schemaSql = `
CREATE TABLE meal_plans (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meal_plan_entries (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_date TEXT NOT NULL,
  section TEXT NOT NULL REFERENCES meal_sections(id) ON UPDATE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES meal_templates(id) ON DELETE CASCADE,
  quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (recipe_id IS NOT NULL) + (food_id IS NOT NULL) + (template_id IS NOT NULL) = 1
  ),
  UNIQUE(plan_id, day_date, section, position)
);

CREATE INDEX idx_meal_plan_entries_plan
  ON meal_plan_entries(plan_id, day_date, section, position);
CREATE INDEX idx_meal_plan_entries_recipe ON meal_plan_entries(recipe_id);
CREATE INDEX idx_meal_plan_entries_food ON meal_plan_entries(food_id);
CREATE INDEX idx_meal_plan_entries_template ON meal_plan_entries(template_id);
`;

export const mealPlanningMigration: Migration = {
  version: 6,
  name: 'meal_planning',
  up: async (database) => {
    await database.execAsync(schemaSql);
  },
};
