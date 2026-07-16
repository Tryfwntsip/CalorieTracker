import type { Database } from '@/db/types';
import { normalizeFoodSearch } from '@/domain/food';
import {
  foodFavoriteSchema,
  foodOverrideSchema,
  foodPortionSchema,
  foodRecentSchema,
  foodSchema,
} from '@/schemas';
import type {
  Food,
  FoodOverride,
  FoodOverrideWrite,
  FoodPortion,
  FoodPortionWrite,
  FoodWrite,
} from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';

const selectFood = `
SELECT f.id, COALESCE(o.name, f.name) AS name, COALESCE(o.name_el, f.name_el) AS nameEl,
  f.brand, f.barcode, f.source, f.external_id AS externalId,
  f.source_updated_at AS sourceUpdatedAt, f.quality, f.nova_class AS novaClass,
  f.is_liquid AS isLiquid, f.serving_name AS servingName, f.serving_grams AS servingGrams,
  COALESCE(o.energy_kcal, f.energy_kcal) AS energyKcal,
  COALESCE(o.protein_g, f.protein_g) AS proteinG,
  COALESCE(o.carbs_g, f.carbs_g) AS carbsG, COALESCE(o.fat_g, f.fat_g) AS fatG,
  COALESCE(o.sat_fat_g, f.sat_fat_g) AS satFatG, f.mono_fat_g AS monoFatG,
  f.poly_fat_g AS polyFatG, COALESCE(o.fiber_g, f.fiber_g) AS fiberG,
  COALESCE(o.sugar_g, f.sugar_g) AS sugarG, COALESCE(o.salt_g, f.salt_g) AS saltG,
  COALESCE(o.sodium_mg, f.sodium_mg) AS sodiumMg,
  f.cholesterol_mg AS cholesterolMg, f.micros_json AS micros,
  f.created_at AS createdAt, f.updated_at AS updatedAt
FROM foods f LEFT JOIN food_overrides o ON o.food_id = f.id
`;

const selectPortion = `
SELECT id, food_id AS foodId, label, label_el AS labelEl, grams
FROM food_portions
`;

export interface FoodRepository {
  get(id: string): Promise<Food | null>;
  list(): Promise<Food[]>;
  search(query: string, limit?: number): Promise<Food[]>;
  getByBarcode(barcode: string): Promise<Food | null>;
  getByExternal(source: Food['source'], externalId: string): Promise<Food | null>;
  create(food: FoodWrite): Promise<Food>;
  upsertExternal(food: FoodWrite): Promise<Food>;
  update(food: FoodWrite): Promise<Food>;
  delete(id: string): Promise<void>;
  getPortion(id: string): Promise<FoodPortion | null>;
  listPortions(foodId: string): Promise<FoodPortion[]>;
  createPortion(portion: FoodPortionWrite): Promise<FoodPortion>;
  updatePortion(portion: FoodPortionWrite): Promise<FoodPortion>;
  deletePortion(id: string): Promise<void>;
  getOverride(foodId: string): Promise<FoodOverride | null>;
  saveOverride(override: FoodOverrideWrite): Promise<FoodOverride>;
  deleteOverride(foodId: string): Promise<void>;
  isFavorite(foodId: string): Promise<boolean>;
  listFavorites(): Promise<Food[]>;
  setFavorite(foodId: string, favorite: boolean): Promise<void>;
  listRecents(limit?: number): Promise<Food[]>;
  markRecent(foodId: string): Promise<void>;
}

export function createFoodRepository(
  database: Database,
  clock: Clock = systemClock,
): FoodRepository {
  const get = async (id: string): Promise<Food | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectFood} WHERE f.id = ?`, id);
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

  const getOverride = async (foodId: string): Promise<FoodOverride | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(
        `SELECT food_id AS foodId, name, name_el AS nameEl,
          energy_kcal AS energyKcal, protein_g AS proteinG, carbs_g AS carbsG,
          fat_g AS fatG, sat_fat_g AS satFatG, fiber_g AS fiberG,
          sugar_g AS sugarG, salt_g AS saltG, sodium_mg AS sodiumMg,
          updated_at AS updatedAt
         FROM food_overrides WHERE food_id = ?`,
        foodId,
      );
      return row === null ? null : parseRecord(foodOverrideSchema, row, 'food_override');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'food_override');
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

  const insertFood = async (food: FoodWrite): Promise<void> => {
    const now = clock.now();
    await database.runAsync(
      `INSERT INTO foods (
        id, name, name_el, brand, barcode, source, external_id, source_updated_at,
        quality, nova_class, is_liquid, serving_name, serving_grams, energy_kcal,
        protein_g, carbs_g, fat_g, sat_fat_g, mono_fat_g, poly_fat_g, fiber_g,
        sugar_g, salt_g, sodium_mg, cholesterol_mg, micros_json, created_at, updated_at,
        search_name, search_name_el
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      food.id,
      ...foodParams(food),
      now,
      now,
      normalizeFoodSearch(food.name),
      normalizeFoodSearch(food.nameEl ?? ''),
    );
  };

  return {
    get,
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(`${selectFood} ORDER BY name, f.id`);
        return rows.map((row) => parseRecord(foodSchema, row, 'food'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async search(query, limit = 40) {
      try {
        const normalized = normalizeFoodSearch(query);
        if (!normalized) return [];
        const pattern = `%${normalized}%`;
        const rows = await database.getAllAsync<unknown>(
          `${selectFood}
           WHERE f.search_name LIKE ? OR f.search_name_el LIKE ?
             OR o.search_name LIKE ? OR o.search_name_el LIKE ?
           ORDER BY
             CASE f.source WHEN 'user' THEN 0 WHEN 'greek_seed' THEN 1 ELSE 2 END,
             CASE
               WHEN f.search_name = ? OR f.search_name_el = ?
                 OR o.search_name = ? OR o.search_name_el = ? THEN 0
               WHEN f.search_name LIKE ? OR f.search_name_el LIKE ?
                 OR o.search_name LIKE ? OR o.search_name_el LIKE ? THEN 1
               ELSE 2
             END,
             name, f.id
           LIMIT ?`,
          pattern,
          pattern,
          pattern,
          pattern,
          normalized,
          normalized,
          normalized,
          normalized,
          `${normalized}%`,
          `${normalized}%`,
          `${normalized}%`,
          `${normalized}%`,
          limit,
        );
        return rows.map((row) => parseRecord(foodSchema, row, 'food'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async getByBarcode(barcode) {
      try {
        const row = await database.getFirstAsync<unknown>(
          `${selectFood} WHERE f.barcode = ? ORDER BY
            CASE f.source WHEN 'user' THEN 0 WHEN 'greek_seed' THEN 1 ELSE 2 END,
            f.updated_at DESC, f.id
           LIMIT 1`,
          barcode,
        );
        return row === null ? null : parseRecord(foodSchema, row, 'food');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async getByExternal(source, externalId) {
      try {
        const row = await database.getFirstAsync<unknown>(
          `${selectFood} WHERE f.source = ? AND f.external_id = ?`,
          source,
          externalId,
        );
        return row === null ? null : parseRecord(foodSchema, row, 'food');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async create(food) {
      try {
        await insertFood(food);
        const created = await get(food.id);
        if (!created) throw new Error('Inserted food was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food');
      }
    },
    async upsertExternal(food) {
      try {
        if (!food.externalId) throw new Error('External foods require an external ID.');
        const existing = await database.getFirstAsync<{ id: string }>(
          'SELECT id FROM foods WHERE source = ? AND external_id = ?',
          food.source,
          food.externalId,
        );
        if (existing) {
          await database.runAsync(
            `UPDATE foods SET
              name = ?, name_el = ?, brand = ?, barcode = ?, source_updated_at = ?,
              quality = ?, nova_class = ?, is_liquid = ?, serving_name = ?,
              serving_grams = ?, energy_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
              sat_fat_g = ?, mono_fat_g = ?, poly_fat_g = ?, fiber_g = ?, sugar_g = ?,
              salt_g = ?, sodium_mg = ?, cholesterol_mg = ?, micros_json = ?,
              updated_at = ?, search_name = ?, search_name_el = ?
             WHERE id = ?`,
            food.name,
            food.nameEl,
            food.brand,
            food.barcode,
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
            clock.now(),
            normalizeFoodSearch(food.name),
            normalizeFoodSearch(food.nameEl ?? ''),
            existing.id,
          );
          const updated = await get(existing.id);
          if (!updated) throw new Error('Updated external food was not found.');
          return updated;
        }
        await insertFood(food);
        const created = await get(food.id);
        if (!created) throw new Error('Inserted external food was not found.');
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
            micros_json = ?, updated_at = ?, search_name = ?, search_name_el = ?
          WHERE id = ?`,
          ...foodParams(food),
          clock.now(),
          normalizeFoodSearch(food.name),
          normalizeFoodSearch(food.nameEl ?? ''),
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
    getOverride,
    async saveOverride(override) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO food_overrides (
            food_id, name, name_el, search_name, search_name_el, energy_kcal,
            protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g, salt_g,
            sodium_mg, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(food_id) DO UPDATE SET
            name = excluded.name, name_el = excluded.name_el,
            search_name = excluded.search_name, search_name_el = excluded.search_name_el,
            energy_kcal = excluded.energy_kcal, protein_g = excluded.protein_g,
            carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
            sat_fat_g = excluded.sat_fat_g, fiber_g = excluded.fiber_g,
            sugar_g = excluded.sugar_g, salt_g = excluded.salt_g,
            sodium_mg = excluded.sodium_mg, updated_at = excluded.updated_at`,
          override.foodId,
          override.name,
          override.nameEl,
          normalizeFoodSearch(override.name),
          normalizeFoodSearch(override.nameEl ?? ''),
          override.energyKcal,
          override.proteinG,
          override.carbsG,
          override.fatG,
          override.satFatG,
          override.fiberG,
          override.sugarG,
          override.saltG,
          override.sodiumMg,
          now,
        );
        const saved = await getOverride(override.foodId);
        if (!saved) throw new Error('Saved food override was not found.');
        return saved;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_override');
      }
    },
    async deleteOverride(foodId) {
      try {
        const result = await database.runAsync(
          'DELETE FROM food_overrides WHERE food_id = ?',
          foodId,
        );
        assertChanged(result.changes, 'food_override');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_override');
      }
    },
    async isFavorite(foodId) {
      const row = await database.getFirstAsync<{ foodId: string }>(
        'SELECT food_id AS foodId FROM food_favorites WHERE food_id = ?',
        foodId,
      );
      return foodFavoriteSchema.pick({ foodId: true }).safeParse(row).success;
    },
    async listFavorites() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectFood}
           INNER JOIN food_favorites ff ON ff.food_id = f.id
           ORDER BY ff.created_at DESC`,
        );
        return rows.map((row) => parseRecord(foodSchema, row, 'food'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_favorite');
      }
    },
    async setFavorite(foodId, favorite) {
      try {
        if (favorite) {
          const now = clock.now();
          await database.runAsync(
            `INSERT INTO food_favorites (food_id, created_at) VALUES (?, ?)
             ON CONFLICT(food_id) DO NOTHING`,
            foodId,
            now,
          );
          parseRecord(foodFavoriteSchema, { foodId, createdAt: now }, 'food_favorite');
        } else {
          await database.runAsync('DELETE FROM food_favorites WHERE food_id = ?', foodId);
        }
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_favorite');
      }
    },
    async listRecents(limit = 20) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectFood}
           INNER JOIN food_recents fr ON fr.food_id = f.id
           ORDER BY fr.last_used_at DESC LIMIT ?`,
          limit,
        );
        return rows.map((row) => parseRecord(foodSchema, row, 'food'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_recent');
      }
    },
    async markRecent(foodId) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO food_recents (food_id, last_used_at, use_count)
           VALUES (?, ?, 1)
           ON CONFLICT(food_id) DO UPDATE SET
             last_used_at = excluded.last_used_at, use_count = food_recents.use_count + 1`,
          foodId,
          now,
        );
        const row = await database.getFirstAsync<unknown>(
          `SELECT food_id AS foodId, last_used_at AS lastUsedAt, use_count AS useCount
           FROM food_recents WHERE food_id = ?`,
          foodId,
        );
        parseRecord(foodRecentSchema, row, 'food_recent');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'food_recent');
      }
    },
  };
}
