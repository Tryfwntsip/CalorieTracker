import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSettings } from '@/db/preferences';
import { initializeDatabase } from '@/db/initialize';
import { getPreference, setPreference } from '@/lib/storage';
import { createSettingsRepository } from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('settings preference migration and persistence', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    await AsyncStorage.clear();
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it('imports M1 values once, then restores the cache from authoritative SQLite settings', async () => {
    await setPreference('language', 'el');
    await setPreference('themePreference', 'dark');
    await ensureSettings(database);

    const repository = createSettingsRepository(database);
    expect(await repository.get()).toMatchObject({ language: 'el', theme: 'dark' });

    await repository.updateLanguage('en');
    await repository.updateTheme('light');
    await setPreference('language', 'el');
    await setPreference('themePreference', 'dark');

    await ensureSettings(database);

    expect(await getPreference('language')).toBe('en');
    expect(await getPreference('themePreference')).toBe('light');
  });
});
