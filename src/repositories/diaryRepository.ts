import type { Database } from '@/db/types';
import { diaryDaySchema, diaryEntrySchema } from '@/schemas';
import type { DiaryDay, DiaryDayWrite, DiaryEntry, DiaryEntryWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';

const selectDay = `
SELECT date, mood, note, created_at AS createdAt, updated_at AS updatedAt
FROM diary_days
`;

const selectEntry = `
SELECT id, day_date AS dayDate, section, food_id AS foodId, custom_label AS customLabel,
  quantity, unit, grams_resolved AS gramsResolved, energy_kcal AS energyKcal,
  protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG, sat_fat_g AS satFatG,
  fiber_g AS fiberG, sugar_g AS sugarG, sodium_mg AS sodiumMg,
  micros_snapshot_json AS microsSnapshot, logged_via AS loggedVia,
  deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt
FROM diary_entries
`;

export interface DiaryRepository {
  getDay(date: string): Promise<DiaryDay | null>;
  createDay(day: DiaryDayWrite): Promise<DiaryDay>;
  updateDay(day: DiaryDayWrite): Promise<DiaryDay>;
  deleteDay(date: string): Promise<void>;
  getEntry(id: string): Promise<DiaryEntry | null>;
  listEntries(dayDate: string): Promise<DiaryEntry[]>;
  createEntry(entry: DiaryEntryWrite): Promise<DiaryEntry>;
  updateEntry(entry: DiaryEntryWrite): Promise<DiaryEntry>;
  deleteEntry(id: string): Promise<void>;
}

export function createDiaryRepository(
  database: Database,
  clock: Clock = systemClock,
): DiaryRepository {
  const getDay = async (date: string): Promise<DiaryDay | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectDay} WHERE date = ?`, date);
      return row === null ? null : parseRecord(diaryDaySchema, row, 'diary_day');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'diary_day');
    }
  };

  const getEntry = async (id: string): Promise<DiaryEntry | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(`${selectEntry} WHERE id = ?`, id);
      return row === null ? null : parseRecord(diaryEntrySchema, row, 'diary_entry');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'diary_entry');
    }
  };

  const entryParams = (entry: DiaryEntryWrite) =>
    [
      entry.dayDate,
      entry.section,
      entry.foodId,
      entry.customLabel,
      entry.quantity,
      entry.unit,
      entry.gramsResolved,
      entry.energyKcal,
      entry.proteinG,
      entry.carbsG,
      entry.fatG,
      entry.satFatG,
      entry.fiberG,
      entry.sugarG,
      entry.sodiumMg,
      encodeJson(entry.microsSnapshot),
      entry.loggedVia,
      entry.deletedAt,
    ] as const;

  return {
    getDay,
    async createDay(day) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO diary_days (date, mood, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          day.date,
          day.mood,
          day.note,
          now,
          now,
        );
        const created = await getDay(day.date);
        if (!created) throw new Error('Inserted diary day was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_day');
      }
    },
    async updateDay(day) {
      try {
        const result = await database.runAsync(
          `UPDATE diary_days SET mood = ?, note = ?, updated_at = ? WHERE date = ?`,
          day.mood,
          day.note,
          clock.now(),
          day.date,
        );
        assertChanged(result.changes, 'diary_day');
        const updated = await getDay(day.date);
        if (!updated) throw new Error('Updated diary day was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_day');
      }
    },
    async deleteDay(date) {
      try {
        const result = await database.runAsync('DELETE FROM diary_days WHERE date = ?', date);
        assertChanged(result.changes, 'diary_day');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_day');
      }
    },
    getEntry,
    async listEntries(dayDate) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectEntry} WHERE day_date = ? ORDER BY created_at, id`,
          dayDate,
        );
        return rows.map((row) => parseRecord(diaryEntrySchema, row, 'diary_entry'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async createEntry(entry) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO diary_entries (
            id, day_date, section, food_id, custom_label, quantity, unit, grams_resolved,
            energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g,
            sodium_mg, micros_snapshot_json, logged_via, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          entry.id,
          ...entryParams(entry),
          now,
          now,
        );
        const created = await getEntry(entry.id);
        if (!created) throw new Error('Inserted diary entry was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async updateEntry(entry) {
      try {
        const result = await database.runAsync(
          `UPDATE diary_entries SET
            day_date = ?, section = ?, food_id = ?, custom_label = ?, quantity = ?,
            unit = ?, grams_resolved = ?, energy_kcal = ?, protein_g = ?, carbs_g = ?,
            fat_g = ?, sat_fat_g = ?, fiber_g = ?, sugar_g = ?, sodium_mg = ?,
            micros_snapshot_json = ?, logged_via = ?, deleted_at = ?, updated_at = ?
          WHERE id = ?`,
          ...entryParams(entry),
          clock.now(),
          entry.id,
        );
        assertChanged(result.changes, 'diary_entry');
        const updated = await getEntry(entry.id);
        if (!updated) throw new Error('Updated diary entry was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async deleteEntry(id) {
      try {
        const result = await database.runAsync('DELETE FROM diary_entries WHERE id = ?', id);
        assertChanged(result.changes, 'diary_entry');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
  };
}
