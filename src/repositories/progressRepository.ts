import type { Database } from '@/db/types';
import {
  nutritionAggregateSchema,
  stepsAggregateSchema,
  waterAggregateSchema,
  weightAggregateSchema,
  type NutritionAggregate,
  type StepsAggregate,
  type WaterAggregate,
  type WeightAggregate,
} from '@/schemas/progress';
import { mapRepositoryError, parseRecord } from '@/repositories/errors';

export type ProgressSnapshot = {
  nutrition: NutritionAggregate[];
  weight: WeightAggregate[];
  water: WaterAggregate[];
  steps: StepsAggregate[];
};

export interface ProgressRepository {
  load(fromDay: string, toDay: string): Promise<ProgressSnapshot>;
}

export function createProgressRepository(database: Database): ProgressRepository {
  return {
    async load(fromDay, toDay) {
      try {
        const [nutritionRows, weightRows, waterRows, stepsRows] = await Promise.all([
          database.getAllAsync<unknown>(
            `WITH daily AS (
               SELECT day_date, COALESCE(SUM(energy_kcal), 0) AS energy_kcal,
                 CASE WHEN COUNT(protein_g) = 0 THEN NULL ELSE SUM(protein_g) END AS protein_g,
                 CASE WHEN COUNT(carbs_g) = 0 THEN NULL ELSE SUM(carbs_g) END AS carbs_g,
                 CASE WHEN COUNT(fat_g) = 0 THEN NULL ELSE SUM(fat_g) END AS fat_g
               FROM diary_entries
               WHERE deleted_at IS NULL AND day_date BETWEEN ? AND ?
               GROUP BY day_date
             )
             SELECT d.day_date AS dayDate, d.energy_kcal AS energyKcal,
               d.protein_g AS proteinG, d.carbs_g AS carbsG, d.fat_g AS fatG,
               COALESCE(
                 (
                   SELECT calorie_target FROM profile_goal_history
                   WHERE substr(effective_at, 1, 10) <= d.day_date
                   ORDER BY effective_at DESC, version DESC LIMIT 1
                 ),
                 (
                   SELECT calorie_target FROM profile_goal_history
                   ORDER BY effective_at, version LIMIT 1
                 )
               ) AS calorieTarget
             FROM daily d ORDER BY d.day_date`,
            fromDay,
            toDay,
          ),
          database.getAllAsync<unknown>(
            `SELECT day_date AS dayDate, weight_kg AS weightKg
             FROM weight_records WHERE day_date BETWEEN ? AND ? ORDER BY day_date`,
            fromDay,
            toDay,
          ),
          database.getAllAsync<unknown>(
            `SELECT day_date AS dayDate, SUM(amount_ml) AS amountMl
             FROM water_records WHERE day_date BETWEEN ? AND ?
             GROUP BY day_date ORDER BY day_date`,
            fromDay,
            toDay,
          ),
          database.getAllAsync<unknown>(
            `SELECT day_date AS dayDate, MAX(steps) AS steps
             FROM steps_logs WHERE day_date BETWEEN ? AND ?
             GROUP BY day_date ORDER BY day_date`,
            fromDay,
            toDay,
          ),
        ]);

        return {
          nutrition: nutritionRows.map((row) =>
            parseRecord(nutritionAggregateSchema, row, 'progress_nutrition'),
          ),
          weight: weightRows.map((row) =>
            parseRecord(weightAggregateSchema, row, 'progress_weight'),
          ),
          water: waterRows.map((row) => parseRecord(waterAggregateSchema, row, 'progress_water')),
          steps: stepsRows.map((row) => parseRecord(stepsAggregateSchema, row, 'progress_steps')),
        };
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'progress');
      }
    },
  };
}
