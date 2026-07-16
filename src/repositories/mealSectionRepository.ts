import type { Database } from '@/db/types';
import { mealSectionSchema } from '@/schemas';
import type { MealSection, MealSectionWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';

const selectSection = `
SELECT id, name, name_el AS nameEl, position, is_hidden AS isHidden,
  is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt
FROM meal_sections
`;

export interface MealSectionRepository {
  list(): Promise<MealSection[]>;
  create(section: MealSectionWrite): Promise<MealSection>;
  update(section: MealSectionWrite): Promise<MealSection>;
  delete(id: string): Promise<void>;
  reorder(ids: readonly string[]): Promise<void>;
}

export function createMealSectionRepository(
  database: Database,
  clock: Clock = systemClock,
): MealSectionRepository {
  const get = async (id: string): Promise<MealSection | null> => {
    const row = await database.getFirstAsync<unknown>(`${selectSection} WHERE id = ?`, id);
    return row === null ? null : parseRecord(mealSectionSchema, row, 'meal_section');
  };

  return {
    async list() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectSection} ORDER BY position, created_at, id`,
        );
        return rows.map((row) => parseRecord(mealSectionSchema, row, 'meal_section'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_section');
      }
    },
    async create(section) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO meal_sections (
            id, name, name_el, position, is_hidden, is_default, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          section.id,
          section.name,
          section.nameEl,
          section.position,
          section.isHidden ? 1 : 0,
          section.isDefault ? 1 : 0,
          now,
          now,
        );
        const created = await get(section.id);
        if (!created) throw new Error('Inserted meal section was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_section');
      }
    },
    async update(section) {
      try {
        const result = await database.runAsync(
          `UPDATE meal_sections SET name = ?, name_el = ?, position = ?,
            is_hidden = ?, is_default = ?, updated_at = ? WHERE id = ?`,
          section.name,
          section.nameEl,
          section.position,
          section.isHidden ? 1 : 0,
          section.isDefault ? 1 : 0,
          clock.now(),
          section.id,
        );
        assertChanged(result.changes, 'meal_section');
        const updated = await get(section.id);
        if (!updated) throw new Error('Updated meal section was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_section');
      }
    },
    async delete(id) {
      try {
        const result = await database.runAsync(
          `DELETE FROM meal_sections
           WHERE id = ? AND is_default = 0
             AND NOT EXISTS (SELECT 1 FROM diary_entries WHERE section = ?)`,
          id,
          id,
        );
        assertChanged(result.changes, 'meal_section');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_section');
      }
    },
    async reorder(ids) {
      try {
        await database.withTransactionAsync(async (transaction) => {
          const maximum = await transaction.getFirstAsync<{ position: number }>(
            'SELECT COALESCE(MAX(position), 0) AS position FROM meal_sections',
          );
          const offset = (maximum?.position ?? 0) + ids.length + 1;
          for (const [index, id] of ids.entries()) {
            await transaction.runAsync(
              'UPDATE meal_sections SET position = ?, updated_at = ? WHERE id = ?',
              offset + index,
              clock.now(),
              id,
            );
          }
          for (const [index, id] of ids.entries()) {
            await transaction.runAsync(
              'UPDATE meal_sections SET position = ?, updated_at = ? WHERE id = ?',
              index,
              clock.now(),
              id,
            );
          }
        });
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'meal_section');
      }
    },
  };
}
