import type { Database } from '@/db/types';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { recipeIngredientSchema, recipeSchema } from '@/schemas';
import type { Recipe, RecipeIngredient, RecipeIngredientWrite, RecipeWrite } from '@/types';

const selectRecipe = `
SELECT r.id, r.title, r.title_el AS titleEl, r.servings,
  r.prep_minutes AS prepMinutes, r.cook_minutes AS cookMinutes,
  r.instructions_json AS instructions, r.instructions_el_json AS instructionsEl,
  r.dietary_tags_json AS dietaryTags, r.allergen_tags_json AS allergenTags,
  r.source, CASE WHEN rf.recipe_id IS NULL THEN 0 ELSE 1 END AS isFavorite,
  r.created_at AS createdAt, r.updated_at AS updatedAt
FROM recipes r LEFT JOIN recipe_favorites rf ON rf.recipe_id = r.id
`;

const selectIngredient = `
SELECT ri.id, ri.recipe_id AS recipeId, ri.food_id AS foodId, ri.label,
  f.name_el AS labelEl,
  ri.quantity, ri.unit, ri.grams_resolved AS gramsResolved, ri.position,
  COALESCE(fo.energy_kcal, f.energy_kcal) AS energyKcal,
  COALESCE(fo.protein_g, f.protein_g) AS proteinG,
  COALESCE(fo.carbs_g, f.carbs_g) AS carbsG,
  COALESCE(fo.fat_g, f.fat_g) AS fatG, ri.created_at AS createdAt
FROM recipe_ingredients ri
LEFT JOIN foods f ON f.id = ri.food_id
LEFT JOIN food_overrides fo ON fo.food_id = ri.food_id
`;

export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  get(id: string): Promise<Recipe | null>;
  listIngredients(recipeId: string): Promise<RecipeIngredient[]>;
  create(recipe: RecipeWrite, ingredients: readonly RecipeIngredientWrite[]): Promise<Recipe>;
  update(recipe: RecipeWrite, ingredients: readonly RecipeIngredientWrite[]): Promise<Recipe>;
  delete(id: string): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
}

export function createRecipeRepository(
  database: Database,
  clock: Clock = systemClock,
): RecipeRepository {
  const get = async (id: string): Promise<Recipe | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectRecipe} WHERE r.id = ?`, id);
      return row === null ? null : parseRecord(recipeSchema, row, 'recipe');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'recipe');
    }
  };

  const insertIngredients = async (
    transaction: Database,
    ingredients: readonly RecipeIngredientWrite[],
    timestamp: string,
  ): Promise<void> => {
    for (const ingredient of ingredients) {
      await transaction.runAsync(
        `INSERT INTO recipe_ingredients (
          id, recipe_id, food_id, label, quantity, unit, grams_resolved,
          position, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ingredient.id,
        ingredient.recipeId,
        ingredient.foodId,
        ingredient.label,
        ingredient.quantity,
        ingredient.unit,
        ingredient.gramsResolved,
        ingredient.position,
        timestamp,
      );
    }
  };

  const recipeParams = (recipe: RecipeWrite) =>
    [
      recipe.title,
      recipe.titleEl,
      recipe.servings,
      recipe.prepMinutes,
      recipe.cookMinutes,
      encodeJson(recipe.instructions),
      encodeJson(recipe.instructionsEl),
      encodeJson(recipe.dietaryTags),
      encodeJson(recipe.allergenTags),
      recipe.source,
    ] as const;

  return {
    get,
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectRecipe} ORDER BY isFavorite DESC, r.source, r.title, r.id`,
        );
        return rows.map((row) => parseRecord(recipeSchema, row, 'recipe'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe');
      }
    },
    async listIngredients(recipeId) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectIngredient} WHERE ri.recipe_id = ? ORDER BY ri.position, ri.id`,
          recipeId,
        );
        return rows.map((row) => parseRecord(recipeIngredientSchema, row, 'recipe_ingredient'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe_ingredient');
      }
    },
    async create(recipe, ingredients) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO recipes (
              id, title, title_el, servings, prep_minutes, cook_minutes,
              instructions_json, instructions_el_json, dietary_tags_json,
              allergen_tags_json, source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            recipe.id,
            ...recipeParams(recipe),
            now,
            now,
          );
          await insertIngredients(transaction, ingredients, now);
        });
        const created = await get(recipe.id);
        if (!created) throw new Error('Inserted recipe was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe');
      }
    },
    async update(recipe, ingredients) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          const result = await transaction.runAsync(
            `UPDATE recipes SET title = ?, title_el = ?, servings = ?,
              prep_minutes = ?, cook_minutes = ?, instructions_json = ?,
              instructions_el_json = ?, dietary_tags_json = ?,
              allergen_tags_json = ?, source = ?, updated_at = ? WHERE id = ?`,
            ...recipeParams(recipe),
            now,
            recipe.id,
          );
          assertChanged(result.changes, 'recipe');
          await transaction.runAsync(
            'DELETE FROM recipe_ingredients WHERE recipe_id = ?',
            recipe.id,
          );
          await insertIngredients(transaction, ingredients, now);
        });
        const updated = await get(recipe.id);
        if (!updated) throw new Error('Updated recipe was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe');
      }
    },
    async delete(id) {
      try {
        const result = await database.runAsync('DELETE FROM recipes WHERE id = ?', id);
        assertChanged(result.changes, 'recipe');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe');
      }
    },
    async setFavorite(id, favorite) {
      try {
        if (favorite) {
          await database.runAsync(
            `INSERT INTO recipe_favorites (recipe_id, created_at)
             VALUES (?, ?) ON CONFLICT(recipe_id) DO NOTHING`,
            id,
            clock.now(),
          );
        } else {
          await database.runAsync('DELETE FROM recipe_favorites WHERE recipe_id = ?', id);
        }
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'recipe_favorite');
      }
    },
  };
}
