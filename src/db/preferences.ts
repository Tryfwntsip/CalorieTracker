import type { Database } from '@/db/types';
import { getPreference, setPreference } from '@/lib/storage';
import { createSettingsRepository, defaultSettings, type SettingsRepository } from '@/repositories';

function isLanguage(value: string | null): value is 'en' | 'el' {
  return value === 'en' || value === 'el';
}

function isTheme(value: string | null): value is 'system' | 'light' | 'dark' {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Imports M1 preferences once, then treats SQLite as authoritative while
 * retaining AsyncStorage as a startup cache for pre-database theming/i18n.
 */
export async function ensureSettings(
  database: Database,
  repository: SettingsRepository = createSettingsRepository(database),
): Promise<void> {
  const existing = await repository.get();
  if (existing) {
    await Promise.all([
      setPreference('language', existing.language),
      setPreference('themePreference', existing.theme),
    ]);
    return;
  }

  const [language, theme] = await Promise.all([
    getPreference('language'),
    getPreference('themePreference'),
  ]);

  await repository.create({
    ...defaultSettings,
    language: isLanguage(language) ? language : defaultSettings.language,
    theme: isTheme(theme) ? theme : defaultSettings.theme,
  });
}
