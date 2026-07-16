import { getActiveDatabase } from '@/db/appDatabase';
import { logger } from '@/lib/logger';
import { setPreference } from '@/lib/storage';
import { createSettingsRepository } from '@/repositories';
import type { Settings } from '@/types';

export async function persistTheme(theme: Settings['theme']): Promise<void> {
  await setPreference('themePreference', theme);
  const database = getActiveDatabase();
  if (!database) return;

  try {
    await createSettingsRepository(database).updateTheme(theme);
  } catch (error: unknown) {
    logger.error('settings', 'theme persistence failed', error);
  }
}

export async function persistLanguage(language: Settings['language']): Promise<void> {
  await setPreference('language', language);
  const database = getActiveDatabase();
  if (!database) return;

  try {
    await createSettingsRepository(database).updateLanguage(language);
  } catch (error: unknown) {
    logger.error('settings', 'language persistence failed', error);
  }
}
