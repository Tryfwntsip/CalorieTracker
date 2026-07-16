import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { el } from '@/i18n/el';
import { en } from '@/i18n/en';
import { getPreference, setPreference } from '@/lib/storage';

export const SUPPORTED_LANGUAGES = ['en', 'el'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'language';

// App-owned instance; initReactI18next registers it as the default for useTranslation.
const i18n = createInstance();

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'en' || value === 'el';
}

/** Device language if we support it, else English. */
function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return isAppLanguage(code) ? code : 'en';
}

export async function initI18n(): Promise<void> {
  const stored = await getPreference(STORAGE_KEY);
  const lng = isAppLanguage(stored) ? stored : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      el: { translation: el },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** Persist the user's language choice (the caller changes the active instance). */
export async function persistLanguagePreference(lng: AppLanguage): Promise<void> {
  await setPreference(STORAGE_KEY, lng);
}

export function asAppLanguage(value: string | undefined): AppLanguage {
  return isAppLanguage(value) ? value : 'en';
}

export default i18n;
