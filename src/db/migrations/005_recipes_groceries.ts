import type { Migration } from '@/db/migrations/types';
import { productionFoodSeeds } from '@/db/seed/productionFoods';
import { productionRecipeSeeds } from '@/db/seed/productionRecipes';

const releasedAt = '2026-07-16T00:00:00.000Z';

const schemaSql = `
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  title_el TEXT,
  servings REAL NOT NULL CHECK (servings > 0),
  prep_minutes INTEGER NOT NULL DEFAULT 0 CHECK (prep_minutes >= 0),
  cook_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cook_minutes >= 0),
  instructions_json TEXT NOT NULL,
  instructions_el_json TEXT,
  dietary_tags_json TEXT NOT NULL,
  allergen_tags_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'seed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_recipes_source_title ON recipes(source, title);

CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece')),
  grams_resolved REAL CHECK (grams_resolved IS NULL OR grams_resolved > 0),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(recipe_id, position)
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id, position);
CREATE INDEX idx_recipe_ingredients_food ON recipe_ingredients(food_id);

CREATE TABLE recipe_favorites (
  recipe_id TEXT PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE grocery_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE grocery_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT NOT NULL CHECK (length(trim(label)) > 0),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece')),
  grams_resolved REAL CHECK (grams_resolved IS NULL OR grams_resolved > 0),
  is_checked INTEGER NOT NULL DEFAULT 0 CHECK (is_checked IN (0, 1)),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_grocery_items_list ON grocery_items(list_id, position);
`;

export const recipesGroceriesMigration: Migration = {
  version: 5,
  name: 'recipes_groceries',
  up: async (database) => {
    await database.execAsync(schemaSql);
    const foodIdByName = new Map(productionFoodSeeds.map((food) => [food.name, food.id]));
    for (const recipe of productionRecipeSeeds) {
      await database.runAsync(
        `INSERT INTO recipes (
          id, title, title_el, servings, prep_minutes, cook_minutes,
          instructions_json, instructions_el_json, dietary_tags_json,
          allergen_tags_json, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?)`,
        recipe.id,
        recipe.title,
        recipe.titleEl,
        recipe.servings,
        recipe.prepMinutes,
        recipe.cookMinutes,
        JSON.stringify(recipe.instructions),
        JSON.stringify(recipe.instructionsEl),
        JSON.stringify(recipe.dietaryTags),
        JSON.stringify(recipe.allergenTags),
        releasedAt,
        releasedAt,
      );
      for (const [position, ingredient] of recipe.ingredients.entries()) {
        const foodId = foodIdByName.get(ingredient.foodName);
        if (!foodId) throw new Error(`Missing production food: ${ingredient.foodName}`);
        await database.runAsync(
          `INSERT INTO recipe_ingredients (
            id, recipe_id, food_id, label, quantity, unit, grams_resolved,
            position, created_at
          ) VALUES (?, ?, ?, ?, ?, 'g', ?, ?, ?)`,
          `${recipe.id}-ingredient-${position}`,
          recipe.id,
          foodId,
          ingredient.foodName,
          ingredient.grams,
          ingredient.grams,
          position,
          releasedAt,
        );
      }
    }
  },
};
