import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { DatabaseContext } from '@/db/DatabaseProvider';
import type { Database } from '@/db/types';
import { ProfileContext, type ProfileContextValue } from '@/features/profile/ProfileProvider';
import { el } from '@/i18n/el';
import { en } from '@/i18n/en';
import type { Profile } from '@/types';
import { ThemeProvider } from '@/ui/theme';

const testI18n = createInstance();
void testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, el: { translation: el } },
  interpolation: { escapeValue: false },
});

/** Render helper wrapping the providers every component expects. RNTL v14: async. */
type RenderOptions = {
  database?: Database;
  profile?: Profile | null;
  setProfile?: ProfileContextValue['setProfile'];
};

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  let content = ui;
  if ('profile' in options) {
    content = (
      <ProfileContext.Provider
        value={{
          profile: options.profile ?? null,
          setProfile: options.setProfile ?? (() => undefined),
          refresh: async () => undefined,
        }}
      >
        {content}
      </ProfileContext.Provider>
    );
  }
  if (options.database) {
    content = (
      <DatabaseContext.Provider value={options.database}>{content}</DatabaseContext.Provider>
    );
  }

  return render(
    <I18nextProvider i18n={testI18n}>
      <ThemeProvider>{content}</ThemeProvider>
    </I18nextProvider>,
  );
}

export { testI18n };
