import type { Messages } from './en';

export const el: Messages = {
  common: {
    appName: 'CalorieTracker',
    retry: 'Δοκίμασε ξανά',
    cancel: 'Άκυρο',
    save: 'Αποθήκευση',
    close: 'Κλείσιμο',
    loading: 'Φόρτωση…',
  },
  tabs: {
    today: 'Σήμερα',
    diary: 'Ημερολόγιο',
    progress: 'Πρόοδος',
    plans: 'Πλάνα',
    profile: 'Προφίλ',
  },
  comingSoon: {
    title: 'Δεν έχει υλοποιηθεί ακόμα',
    body: 'Αυτή η ενότητα είναι προγραμματισμένη για επόμενο milestone. Τίποτα εδώ δεν λειτουργεί ακόμα.',
    milestone: 'Έρχεται στο milestone {{milestone}}',
  },
  errors: {
    genericTitle: 'Κάτι πήγε στραβά',
    genericBody: 'Δοκίμασε ξανά.',
  },
  database: {
    preparing: 'Προετοιμασία των τοπικών δεδομένων…',
    errorTitle: 'Τα τοπικά δεδομένα δεν είναι διαθέσιμα',
    errorBody: 'Τα δεδομένα σου δεν άλλαξαν. Δοκίμασε ξανά την προετοιμασία της τοπικής βάσης.',
  },
  profile: {
    title: 'Προφίλ',
    appearance: 'Εμφάνιση',
    theme: {
      label: 'Θέμα',
      system: 'Σύστημα',
      light: 'Φωτεινό',
      dark: 'Σκούρο',
    },
    language: {
      label: 'Γλώσσα',
      en: 'English',
      el: 'Ελληνικά',
    },
    about: {
      title: 'Σχετικά',
      disclaimer:
        'Όλες οι τιμές θερμίδων και θρεπτικών συστατικών στην εφαρμογή είναι ενημερωτικές εκτιμήσεις, όχι ιατρική συμβουλή. Για ιατρικά θέματα, απευθύνσου σε εξειδικευμένο επαγγελματία.',
      version: 'Έκδοση {{version}}',
    },
  },
};
