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
SELECT e.id, e.day_date AS dayDate, e.section, e.food_id AS foodId,
  COALESCE(o.name, f.name) AS foodName, COALESCE(o.name_el, f.name_el) AS foodNameEl,
  e.custom_label AS customLabel, e.quantity, e.unit,
  e.grams_resolved AS gramsResolved, e.energy_kcal AS energyKcal,
  e.protein_g AS proteinG, e.carbs_g AS carbsG, e.fat_g AS fatG,
  e.sat_fat_g AS satFatG, e.fiber_g AS fiberG, e.sugar_g AS sugarG,
  e.sodium_mg AS sodiumMg, e.micros_snapshot_json AS microsSnapshot,
  e.logged_via AS loggedVia, e.deleted_at AS deletedAt,
  e.created_at AS createdAt, e.updated_at AS updatedAt
FROM diary_entries e
LEFT JOIN foods f ON f.id = e.food_id
LEFT JOIN food_overrides o ON o.food_id = e.food_id
`;

export interface DiaryRepository {
  getDay(date: string): Promise<DiaryDay | null>;
  ensureDay(date: string): Promise<DiaryDay>;
  saveDay(day: DiaryDayWrite): Promise<DiaryDay>;
  createDay(day: DiaryDayWrite): Promise<DiaryDay>;
  updateDay(day: DiaryDayWrite): Promise<DiaryDay>;
  deleteDay(date: string): Promise<void>;
  getEntry(id: string): Promise<DiaryEntry | null>;
  listEntries(dayDate: string): Promise<DiaryEntry[]>;
  createEntry(entry: DiaryEntryWrite): Promise<DiaryEntry>;
  updateEntry(entry: DiaryEntryWrite): Promise<DiaryEntry>;
  softDeleteEntry(id: string): Promise<DiaryEntry>;
  restoreEntry(id: string): Promise<DiaryEntry>;
  copyEntries(
    sourceDate: string,
    targetDate: string,
    section: string | null,
    newIds: readonly string[],
  ): Promise<number>;
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
      const row = await database.getFirstAsync<unknown>(`${selectEntry} WHERE e.id = ?`, id);
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

  const ensureDay = async (date: string): Promise<DiaryDay> => {
    try {
      const now = clock.now();
      await database.runAsync(
        `INSERT INTO diary_days (date, mood, note, created_at, updated_at)
         VALUES (?, NULL, NULL, ?, ?)
         ON CONFLICT(date) DO NOTHING`,
        date,
        now,
        now,
      );
      const day = await getDay(date);
      if (!day) throw new Error('Diary day was not found.');
      return day;
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'diary_day');
    }
  };

  return {
    getDay,
    ensureDay,
    async saveDay(day) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO diary_days (date, mood, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             mood = excluded.mood, note = excluded.note, updated_at = excluded.updated_at`,
          day.date,
          day.mood,
          day.note,
          now,
          now,
        );
        const saved = await getDay(day.date);
        if (!saved) throw new Error('Saved diary day was not found.');
        return saved;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_day');
      }
    },
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
          `${selectEntry} WHERE e.day_date = ? ORDER BY e.created_at, e.id`,
          dayDate,
        );
        return rows.map((row) => parseRecord(diaryEntrySchema, row, 'diary_entry'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async createEntry(entry) {
      try {
        await ensureDay(entry.dayDate);
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
    async softDeleteEntry(id) {
      try {
        const now = clock.now();
        const result = await database.runAsync(
          'UPDATE diary_entries SET deleted_at = ?, updated_at = ? WHERE id = ?',
          now,
          now,
          id,
        );
        assertChanged(result.changes, 'diary_entry');
        const deleted = await getEntry(id);
        if (!deleted) throw new Error('Deleted diary entry was not found.');
        return deleted;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async restoreEntry(id) {
      try {
        const result = await database.runAsync(
          'UPDATE diary_entries SET deleted_at = NULL, updated_at = ? WHERE id = ?',
          clock.now(),
          id,
        );
        assertChanged(result.changes, 'diary_entry');
        const restored = await getEntry(id);
        if (!restored) throw new Error('Restored diary entry was not found.');
        return restored;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'diary_entry');
      }
    },
    async copyEntries(sourceDate, targetDate, section, newIds) {
      try {
        const sourceEntries = await database.getAllAsync<DiaryEntry>(
          `${selectEntry}
           WHERE e.day_date = ? AND e.deleted_at IS NULL
             AND (? IS NULL OR e.section = ?)
           ORDER BY e.created_at, e.id`,
          sourceDate,
          section,
          section,
        );
        if (sourceEntries.length !== newIds.length) {
          throw new Error('A new ID is required for each copied diary entry.');
        }
        if (sourceEntries.length === 0) return 0;
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO diary_days (date, mood, note, created_at, updated_at)
             VALUES (?, NULL, NULL, ?, ?)
             ON CONFLICT(date) DO NOTHING`,
            targetDate,
            now,
            now,
          );
          for (const [index, row] of sourceEntries.entries()) {
            const entry = parseRecord(diaryEntrySchema, row, 'diary_entry');
            await transaction.runAsync(
              `INSERT INTO diary_entries (
                id, day_date, section, food_id, custom_label, quantity, unit, grams_resolved,
                energy_kcal, protein_g, carbs_g, fat_g, sat_fat_g, fiber_g, sugar_g,
                sodium_mg, micros_snapshot_json, logged_via, deleted_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
              newIds[index]!,
              targetDate,
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
              now,
              now,
            );
          }
          if (section === null) {
            const sourceDay = await transaction.getFirstAsync<{
              mood: number | null;
              note: string | null;
            }>('SELECT mood, note FROM diary_days WHERE date = ?', sourceDate);
            if (sourceDay) {
              await transaction.runAsync(
                'UPDATE diary_days SET mood = ?, note = ?, updated_at = ? WHERE date = ?',
                sourceDay.mood,
                sourceDay.note,
                now,
                targetDate,
              );
            }
          }
        });
        return sourceEntries.length;
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
