import type { Database } from '@/db/types';
import { foodPortionSchema, foodSchema } from '@/schemas';
import type { Food, FoodPortion, FoodPortionWrite, FoodWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';

const selectFood = `
SELECT id, name, name_el AS nameEl, brand, barcode, source, external_id AS externalId,
  source_updated_at AS sourceUpdatedAt, quality, nova_class AS novaClass,
  is_liquid AS isLiquid, serving_name AS servingName, serving_grams AS servingGrams,
  energy_kcal AS energyKcal, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG,
  sat_fat_g AS satFatG, mono_fat_g AS monoFatG, poly_fat_g AS polyFatG,
  fiber_g AS fiberG, sugar_g AS sugarG, salt_g AS saltG, sodium_mg AS sodiumMg,
  cholesterol_mg AS cholesterolMg, micros_json AS micros,
  created_at AS createdAt, updated_at AS updatedAt
FROM foods
`;

const selectPortion = `
SELECT id, food_id AS foodId, label, label_el AS labelEl, grams
FROM food_portions
`;

export interface FoodRepository {
  get(id: string): Promise<Food | null>;
  list(): Promise<Food[]>;
  create(food: FoodWrite): Promise<Food>;
  update(food: FoodWrite): Promise<Food>;
  delete(id: string): Promise<void>;
  getPortion(id: string): Promise<FoodPortion | null>;
  listPortions(foodId: string): Promise<FoodPortion[]>;
  createPortion(portion: FoodPortionWrite): Promise<FoodPortion>;
  updatePortion(portion: FoodPortionWrite): Promise<FoodPortion>;
  deletePortion(id: string): Promise<void>;
}

export function createFoodRepository(
  database: Database,
  clock: Clock = systemClock,
): FoodRepository {
  const get = async (id: string): Promise<Food | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectFood} WHERE id = ?`, id);
      return row === null ? null : parseRecord(foodSchema, row, 'food');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'food');
    }
  };

  const getPortion = async (id: string): Promise<FoodPortion | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectPortion} WHERE id = ?`, id);
      return row === null ? null : parseRecord(foodPortionSchema, row, 'food_portion');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'food_portion');
    }
  };

  const foodParams = (food: FoodWrite) =>
    [
      food.name,
      food.nameEl,
      food.brand,
      food.barcode,
      food.source,
      food.externalId,
      food.sourceUpdatedAt,
      food.quality,
      food.novaClass,
      food.isLiquid ? 1 : 0,
      food.servingName,
      food.servingGrams,
      food.energyKcal,
      food.proteinG,
      food.carbsG,
      food.fatG,
      food.satFatG,
      food.monoFatG,
      food.polyFatG,
      food.fiberG,
      food.sugarG,
      food.saltG,
      food.sodiumMg,
      food.cholesterolMg,
      encodeJson(food.micros),
    ] as const;

  return {
    get,
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(`${selectFood} ORDER BY name, id`);
        return rows.map((row) => parseRecord(foodSchema, row, 'food'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async create(food) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO foods (
            id, name, name_el, brand, barcode, source, external_id, source_updated_at,
            quality, nova_class, is_liquid, serving_name, serving_grams, energy_kcal,
            protein_g, carbs_g, fat_g, sat_fat_g, mono_fat_g, poly_fat_g, fiber_g,
            sugar_g, salt_g, sodium_mg, cholesterol_mg, micros_json, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )`,
          food.id,
          ...foodParams(food),
          now,
          now,
        );
        const created = await get(food.id);
        if (!created) throw new Error('Inserted food was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async update(food) {
      try {
        const result = await database.runAsync(
          `UPDATE foods SET
            name = ?, name_el = ?, brand = ?, barcode = ?, source = ?, external_id = ?,
            source_updated_at = ?, quality = ?, nova_class = ?, is_liquid = ?,
            serving_name = ?, serving_grams = ?, energy_kcal = ?, protein_g = ?,
            carbs_g = ?, fat_g = ?, sat_fat_g = ?, mono_fat_g = ?, poly_fat_g = ?,
            fiber_g = ?, sugar_g = ?, salt_g = ?, sodium_mg = ?, cholesterol_mg = ?,
            micros_json = ?, updated_at = ?
          WHERE id = ?`,
          ...foodParams(food),
          clock.now(),
          food.id,
        );
        assertChanged(result.changes, 'food');
        const updated = await get(food.id);
        if (!updated) throw new Error('Updated food was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async delete(id) {
      try {
        const result = await database.runAsync('DELETE FROM foods WHERE id = ?', id);
        assertChanged(result.changes, 'food');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    getPortion,
    async listPortions(foodId) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectPortion} WHERE food_id = ? ORDER BY grams, id`,
          foodId,
        );
        return rows.map((row) => parseRecord(foodPortionSchema, row, 'food_portion'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_portion');
      }
    },
    async createPortion(portion) {
      try {
        await database.runAsync(
          `INSERT INTO food_portions (id, food_id, label, label_el, grams)
           VALUES (?, ?, ?, ?, ?)`,
          portion.id,
          portion.foodId,
          portion.label,
          portion.labelEl,
          portion.grams,
        );
        const created = await getPortion(portion.id);
        if (!created) throw new Error('Inserted portion was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_portion');
      }
    },
    async updatePortion(portion) {
      try {
        const result = await database.runAsync(
          `UPDATE food_portions SET food_id = ?, label = ?, label_el = ?, grams = ?
           WHERE id = ?`,
          portion.foodId,
          portion.label,
          portion.labelEl,
          portion.grams,
          portion.id,
        );
        assertChanged(result.changes, 'food_portion');
        const updated = await getPortion(portion.id);
        if (!updated) throw new Error('Updated portion was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_portion');
      }
    },
    async deletePortion(id) {
      try {
        const result = await database.runAsync('DELETE FROM food_portions WHERE id = ?', id);
        assertChanged(result.changes, 'food_portion');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_portion');
      }
    },
  };
}
