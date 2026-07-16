import type { Database } from '@/db/types';
import { mealTemplateItemSchema, mealTemplateSchema } from '@/schemas';
import type {
  MealTemplate,
  MealTemplateItem,
  MealTemplateItemWrite,
  MealTemplateWrite,
} from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';

const selectTemplate = `
SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
FROM meal_templates
`;

const selectItem = `
SELECT id, template_id AS templateId, food_id AS foodId, grams, position,
  created_at AS createdAt
FROM meal_template_items
`;

export interface MealTemplateRepository {
  list(): Promise<MealTemplate[]>;
  get(id: string): Promise<MealTemplate | null>;
  create(
    template: MealTemplateWrite,
    items: readonly MealTemplateItemWrite[],
  ): Promise<MealTemplate>;
  update(template: MealTemplateWrite): Promise<MealTemplate>;
  delete(id: string): Promise<void>;
  listItems(templateId: string): Promise<MealTemplateItem[]>;
}

export function createMealTemplateRepository(
  database: Database,
  clock: Clock = systemClock,
): MealTemplateRepository {
  const get = async (id: string): Promise<MealTemplate | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectTemplate} WHERE id = ?`, id);
      return row === null ? null : parseRecord(mealTemplateSchema, row, 'meal_template');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'meal_template');
    }
  };

  return {
    get,
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectTemplate} ORDER BY updated_at DESC, id`,
        );
        return rows.map((row) => parseRecord(mealTemplateSchema, row, 'meal_template'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_template');
      }
    },
    async create(template, items) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO meal_templates (id, name, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
            template.id,
            template.name,
            now,
            now,
          );
          for (const item of items) {
            await transaction.runAsync(
              `INSERT INTO meal_template_items (
                id, template_id, food_id, grams, position, created_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              item.id,
              template.id,
              item.foodId,
              item.grams,
              item.position,
              now,
            );
          }
        });
        const created = await get(template.id);
        if (!created) throw new Error('Inserted meal template was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_template');
      }
    },
    async update(template) {
      try {
        const result = await database.runAsync(
          'UPDATE meal_templates SET name = ?, updated_at = ? WHERE id = ?',
          template.name,
          clock.now(),
          template.id,
        );
        assertChanged(result.changes, 'meal_template');
        const updated = await get(template.id);
        if (!updated) throw new Error('Updated meal template was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_template');
      }
    },
    async delete(id) {
      try {
        const result = await database.runAsync('DELETE FROM meal_templates WHERE id = ?', id);
        assertChanged(result.changes, 'meal_template');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_template');
      }
    },
    async listItems(templateId) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectItem} WHERE template_id = ? ORDER BY position, id`,
          templateId,
        );
        return rows.map((row) => parseRecord(mealTemplateItemSchema, row, 'meal_template_item'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_template_item');
      }
    },
  };
}
