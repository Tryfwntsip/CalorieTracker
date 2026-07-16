/**
 * English resources — the reference locale. Every key here MUST exist in
 * el.ts too (enforced by src/i18n/__tests__/parity.test.ts).
 */
export const en = {
  common: {
    appName: 'CalorieTracker',
    retry: 'Try again',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    loading: 'Loading…',
  },
  tabs: {
    today: 'Today',
    diary: 'Diary',
    progress: 'Progress',
    plans: 'Plans',
    profile: 'Profile',
  },
  comingSoon: {
    title: 'Not built yet',
    body: 'This area is planned for a later milestone. Nothing here is functional yet.',
    milestone: 'Coming in milestone {{milestone}}',
  },
  errors: {
    genericTitle: 'Something went wrong',
    genericBody: 'Please try again.',
  },
  profile: {
    title: 'Profile',
    appearance: 'Appearance',
    theme: {
      label: 'Theme',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    language: {
      label: 'Language',
      en: 'English',
      el: 'Ελληνικά',
    },
    about: {
      title: 'About',
      disclaimer:
        'All calorie and nutrient values in this app are informational estimates, not medical advice. For medical questions, talk to a qualified professional.',
      version: 'Version {{version}}',
    },
  },
};

/** Shape contract for all locales: same keys, string leaves. */
export type Messages = typeof en;
