import type { Database } from '@/db/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';
import { mealPlanEntrySchema, mealPlanSchema } from '@/schemas';
import type { MealPlan, MealPlanEntry, MealPlanEntryWrite, MealPlanWrite } from '@/types';

const selectPlan = `
SELECT id, week_start AS weekStart, created_at AS createdAt, updated_at AS updatedAt
FROM meal_plans
`;

const selectEntry = `
SELECT mpe.id, mpe.plan_id AS planId, mpe.day_date AS dayDate, mpe.section,
  mpe.recipe_id AS recipeId, mpe.food_id AS foodId, mpe.template_id AS templateId,
  mpe.quantity, mpe.position,
  COALESCE(r.title, fo.name, f.name, mt.name) AS label,
  COALESCE(r.title_el, fo.name_el, f.name_el) AS labelEl,
  mpe.created_at AS createdAt, mpe.updated_at AS updatedAt
FROM meal_plan_entries mpe
LEFT JOIN recipes r ON r.id = mpe.recipe_id
LEFT JOIN foods f ON f.id = mpe.food_id
LEFT JOIN food_overrides fo ON fo.food_id = mpe.food_id
LEFT JOIN meal_templates mt ON mt.id = mpe.template_id
`;

export interface MealPlanRepository {
  getByWeek(weekStart: string): Promise<MealPlan | null>;
  create(plan: MealPlanWrite): Promise<MealPlan>;
  listEntries(planId: string): Promise<MealPlanEntry[]>;
  saveEntry(entry: MealPlanEntryWrite): Promise<MealPlanEntry>;
  deleteEntry(id: string): Promise<void>;
  replaceWeek(
    sourcePlanId: string,
    target: MealPlanWrite,
    targetDates: readonly string[],
    newIds: readonly string[],
  ): Promise<MealPlan>;
}

export function createMealPlanRepository(
  database: Database,
  clock: Clock = systemClock,
): MealPlanRepository {
  const getByWeek = async (weekStart: string): Promise<MealPlan | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(
        `${selectPlan} WHERE week_start = ?`,
        weekStart,
      );
      return row === null ? null : parseRecord(mealPlanSchema, row, 'meal_plan');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'meal_plan');
    }
  };

  const getEntry = async (id: string): Promise<MealPlanEntry | null> => {
    const row = await database.getFirstAsync<unknown>(`${selectEntry} WHERE mpe.id = ?`, id);
    return row === null ? null : parseRecord(mealPlanEntrySchema, row, 'meal_plan_entry');
  };

  const create = async (plan: MealPlanWrite): Promise<MealPlan> => {
    try {
      const now = clock.now();
      await database.runAsync(
        `INSERT INTO meal_plans (id, week_start, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        plan.id,
        plan.weekStart,
        now,
        now,
      );
      const created = await getByWeek(plan.weekStart);
      if (!created) throw new Error('Inserted meal plan was not found.');
      return created;
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'meal_plan');
    }
  };

  return {
    getByWeek,
    create,
    async listEntries(planId) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectEntry}
           WHERE mpe.plan_id = ?
           ORDER BY mpe.day_date, mpe.section, mpe.position, mpe.id`,
          planId,
        );
        return rows.map((row) => parseRecord(mealPlanEntrySchema, row, 'meal_plan_entry'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_plan_entry');
      }
    },
    async saveEntry(entry) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO meal_plan_entries (
              id, plan_id, day_date, section, recipe_id, food_id, template_id,
              quantity, position, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plan_id, day_date, section, position) DO UPDATE SET
              recipe_id = excluded.recipe_id, food_id = excluded.food_id,
              template_id = excluded.template_id, quantity = excluded.quantity,
              updated_at = excluded.updated_at`,
            entry.id,
            entry.planId,
            entry.dayDate,
            entry.section,
            entry.recipeId,
            entry.foodId,
            entry.templateId,
            entry.quantity,
            entry.position,
            now,
            now,
          );
          await transaction.runAsync(
            'UPDATE meal_plans SET updated_at = ? WHERE id = ?',
            now,
            entry.planId,
          );
        });
        const saved = await database.getFirstAsync<{ id: string }>(
          `SELECT id FROM meal_plan_entries
           WHERE plan_id = ? AND day_date = ? AND section = ? AND position = ?`,
          entry.planId,
          entry.dayDate,
          entry.section,
          entry.position,
        );
        if (!saved) throw new Error('Saved meal plan entry was not found.');
        const result = await getEntry(saved.id);
        if (!result) throw new Error('Saved meal plan entry was not found.');
        return result;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_plan_entry');
      }
    },
    async deleteEntry(id) {
      try {
        const result = await database.runAsync('DELETE FROM meal_plan_entries WHERE id = ?', id);
        assertChanged(result.changes, 'meal_plan_entry');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_plan_entry');
      }
    },
    async replaceWeek(sourcePlanId, target, targetDates, newIds) {
      try {
        const sourceEntries = await database.getAllAsync<{
          recipe_id: string | null;
          food_id: string | null;
          template_id: string | null;
          section: string;
          quantity: number;
          position: number;
        }>(
          `SELECT recipe_id, food_id, template_id, section, quantity, position
           FROM meal_plan_entries WHERE plan_id = ?
           ORDER BY day_date, section, position, id`,
          sourcePlanId,
        );
        if (sourceEntries.length !== newIds.length || targetDates.length !== newIds.length) {
          throw new Error('Each copied entry requires an ID and target date.');
        }
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO meal_plans (id, week_start, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(week_start) DO UPDATE SET updated_at = excluded.updated_at`,
            target.id,
            target.weekStart,
            now,
            now,
          );
          const targetRow = await transaction.getFirstAsync<{ id: string }>(
            'SELECT id FROM meal_plans WHERE week_start = ?',
            target.weekStart,
          );
          if (!targetRow) throw new Error('Target meal plan was not found.');
          await transaction.runAsync(
            'DELETE FROM meal_plan_entries WHERE plan_id = ?',
            targetRow.id,
          );
          for (const [index, entry] of sourceEntries.entries()) {
            await transaction.runAsync(
              `INSERT INTO meal_plan_entries (
                id, plan_id, day_date, section, recipe_id, food_id, template_id,
                quantity, position, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              newIds[index],
              targetRow.id,
              targetDates[index],
              entry.section,
              entry.recipe_id,
              entry.food_id,
              entry.template_id,
              entry.quantity,
              entry.position,
              now,
              now,
            );
          }
        });
        const copied = await getByWeek(target.weekStart);
        if (!copied) throw new Error('Copied meal plan was not found.');
        return copied;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_plan');
      }
    },
  };
}
