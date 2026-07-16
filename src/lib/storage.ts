import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin wrapper over AsyncStorage for the startup cache of theme and language.
 * SQLite is authoritative from M2; this cache lets the app render its saved
 * appearance while the database is opening. Never store sensitive data here.
 */
const PREFIX = 'ct:';

export async function getPreference(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, value);
  } catch {
    // Preferences are best-effort; failure must never crash the app.
  }
}
