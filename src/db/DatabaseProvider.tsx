import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { initializeAppDatabase } from '@/db/appDatabase';
import type { Database } from '@/db/types';
import { logger } from '@/lib/logger';
import { AppText, ErrorState } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

export const DatabaseContext = createContext<Database | null>(null);

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; database: Database };

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });

  const initialize = useCallback(() => {
    void initializeAppDatabase()
      .then((database) => setState({ status: 'ready', database }))
      .catch((error: unknown) => {
        logger.error('database', 'initialization failed', error);
        setState({ status: 'error' });
      });
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    initialize();
  }, [initialize]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (state.status === 'loading') {
    return (
      <View
        style={[styles.state, { backgroundColor: colors.background }]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText color="secondary">{t('database.preparing')}</AppText>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <ErrorState
          title={t('database.errorTitle')}
          body={t('database.errorBody')}
          onRetry={retry}
        />
      </View>
    );
  }

  return <DatabaseContext.Provider value={state.database}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): Database {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error('useDatabase must be used inside DatabaseProvider');
  return database;
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
