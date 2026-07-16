import type { Database } from '@/db/types';
import { settingsSchema } from '@/schemas';
import type { Settings, SettingsWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';

const selectSettings = `
SELECT id, language, theme, unit_system AS unitSystem, water_goal_ml AS waterGoalMl,
  week_starts_on AS weekStartsOn, diary_section_order AS diarySectionOrder,
  weekday_calorie_overrides AS weekdayCalorieOverrides,
  created_at AS createdAt, updated_at AS updatedAt
FROM settings WHERE id = 1
`;

export const defaultSettings: SettingsWrite = {
  language: 'en',
  theme: 'system',
  unitSystem: 'metric',
  waterGoalMl: 2000,
  weekStartsOn: 1,
  diarySectionOrder: null,
  weekdayCalorieOverrides: null,
};

export interface SettingsRepository {
  get(): Promise<Settings | null>;
  create(settings: SettingsWrite): Promise<Settings>;
  update(settings: SettingsWrite): Promise<Settings>;
  updateLanguage(language: Settings['language']): Promise<Settings>;
  updateTheme(theme: Settings['theme']): Promise<Settings>;
  delete(): Promise<void>;
}

export function createSettingsRepository(
  database: Database,
  clock: Clock = systemClock,
): SettingsRepository {
  const get = async (): Promise<Settings | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(selectSettings);
      return row === null ? null : parseRecord(settingsSchema, row, 'settings');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'settings');
    }
  };

  const params = (settings: SettingsWrite) =>
    [
      settings.language,
      settings.theme,
      settings.unitSystem,
      settings.waterGoalMl,
      settings.weekStartsOn,
      encodeJson(settings.diarySectionOrder),
      encodeJson(settings.weekdayCalorieOverrides),
    ] as const;

  return {
    get,
    async create(settings) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO settings (
            id, language, theme, unit_system, water_goal_ml, week_starts_on,
            diary_section_order, weekday_calorie_overrides, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ...params(settings),
          now,
          now,
        );
        const created = await get();
        if (!created) throw new Error('Inserted settings were not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'settings');
      }
    },
    async update(settings) {
      try {
        const result = await database.runAsync(
          `UPDATE settings SET language = ?, theme = ?, unit_system = ?,
            water_goal_ml = ?, week_starts_on = ?, diary_section_order = ?,
            weekday_calorie_overrides = ?, updated_at = ?
          WHERE id = 1`,
          ...params(settings),
          clock.now(),
        );
        assertChanged(result.changes, 'settings');
        const updated = await get();
        if (!updated) throw new Error('Updated settings were not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'settings');
      }
    },
    async updateLanguage(language) {
      try {
        const result = await database.runAsync(
          'UPDATE settings SET language = ?, updated_at = ? WHERE id = 1',
          language,
          clock.now(),
        );
        assertChanged(result.changes, 'settings');
        const updated = await get();
        if (!updated) throw new Error('Updated settings were not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'settings');
      }
    },
    async updateTheme(theme) {
      try {
        const result = await database.runAsync(
          'UPDATE settings SET theme = ?, updated_at = ? WHERE id = 1',
          theme,
          clock.now(),
        );
        assertChanged(result.changes, 'settings');
        const updated = await get();
        if (!updated) throw new Error('Updated settings were not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'settings');
      }
    },
    async delete() {
      try {
        const result = await database.runAsync('DELETE FROM settings WHERE id = ?', 1);
        assertChanged(result.changes, 'settings');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'settings');
      }
    },
  };
}
