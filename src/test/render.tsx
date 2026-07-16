import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { el } from '@/i18n/el';
import { en } from '@/i18n/en';
import { ThemeProvider } from '@/ui/theme';

const testI18n = createInstance();
void testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, el: { translation: el } },
  interpolation: { escapeValue: false },
});

/** Render helper wrapping the providers every component expects. RNTL v14: async. */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <ThemeProvider>{ui}</ThemeProvider>
    </I18nextProvider>,
  );
}

export { testI18n };
