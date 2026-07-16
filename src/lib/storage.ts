import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin wrapper over AsyncStorage for small app preferences (theme, language).
 * NOT for sensitive data (tokens go to expo-secure-store in M2) and NOT for
 * user logs (those live in SQLite from M3).
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
