import type { Database } from '@/db/types';
import type { Migration } from '@/db/migrations/types';
import { productionFoodSeeds } from '@/db/seed/productionFoods';
import { normalizeFoodSearch } from '@/domain/food';

const releasedAt = '2026-07-16T00:00:00.000Z';

const catalogSchemaSql = `
ALTER TABLE foods ADD COLUMN search_name TEXT NOT NULL DEFAULT '';
ALTER TABLE foods ADD COLUMN search_name_el TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_foods_search_name ON foods(search_name);
CREATE INDEX idx_foods_search_name_el ON foods(search_name_el);

CREATE TABLE food_overrides (
  food_id TEXT PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  name_el TEXT,
  search_name TEXT NOT NULL,
  search_name_el TEXT NOT NULL,
  energy_kcal REAL CHECK (energy_kcal IS NULL OR energy_kcal >= 0),
  protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  sat_fat_g REAL CHECK (sat_fat_g IS NULL OR sat_fat_g >= 0),
  fiber_g REAL CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sugar_g REAL CHECK (sugar_g IS NULL OR sugar_g >= 0),
  salt_g REAL CHECK (salt_g IS NULL OR salt_g >= 0),
  sodium_mg REAL CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE food_favorites (
  food_id TEXT PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE food_recents (
  food_id TEXT PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,
  last_used_at TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count > 0)
);

CREATE INDEX idx_food_recents_used ON food_recents(last_used_at DESC);

CREATE TABLE meal_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE meal_template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  grams REAL NOT NULL CHECK (grams > 0),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(template_id, position)
);

CREATE INDEX idx_template_items_template ON meal_template_items(template_id, position);
`;

async function seedCatalog(database: Database): Promise<void> {
  for (const food of productionFoodSeeds) {
    await database.runAsync(
      `INSERT OR IGNORE INTO foods (
        id, name, name_el, brand, barcode, source, external_id, source_updated_at,
        quality, nova_class, is_liquid, serving_name, serving_grams, energy_kcal,
        protein_g, carbs_g, fat_g, sat_fat_g, mono_fat_g, poly_fat_g, fiber_g,
        sugar_g, salt_g, sodium_mg, cholesterol_mg, micros_json, created_at,
        updated_at, search_name, search_name_el
      ) VALUES (
        ?, ?, ?, NULL, NULL, 'greek_seed', ?, NULL, 'complete', 1, ?, ?, ?, ?,
        ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?
      )`,
      food.id,
      food.name,
      food.nameEl,
      food.externalId,
      food.isLiquid ? 1 : 0,
      food.servingName,
      food.servingGrams,
      food.energyKcal,
      food.proteinG,
      food.carbsG,
      food.fatG,
      food.satFatG,
      food.fiberG,
      food.sugarG,
      food.saltG,
      food.saltG * 400,
      releasedAt,
      releasedAt,
      normalizeFoodSearch(food.name),
      normalizeFoodSearch(food.nameEl),
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO food_portions (id, food_id, label, label_el, grams)
       VALUES (?, ?, ?, ?, ?)`,
      `${food.id}-portion`,
      food.id,
      food.servingName,
      food.servingNameEl,
      food.servingGrams,
    );
  }
}

export const foodCatalogMigration: Migration = {
  version: 4,
  name: 'food_catalog',
  up: async (database) => {
    await database.execAsync(catalogSchemaSql);
    const existing = await database.getAllAsync<{
      id: string;
      name: string;
      name_el: string | null;
    }>('SELECT id, name, name_el FROM foods');
    for (const food of existing) {
      await database.runAsync(
        'UPDATE foods SET search_name = ?, search_name_el = ? WHERE id = ?',
        normalizeFoodSearch(food.name),
        normalizeFoodSearch(food.name_el ?? ''),
        food.id,
      );
    }
    await seedCatalog(database);
  },
};
