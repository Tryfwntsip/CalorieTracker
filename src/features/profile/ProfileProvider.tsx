import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDatabase } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { createProfileRepository } from '@/repositories';
import type { Profile } from '@/types';
import { AppText, ErrorState } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

export type ProfileContextValue = {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  refresh: () => Promise<void>;
};

export const ProfileContext = createContext<ProfileContextValue | null>(null);

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; profile: Profile | null };

export function ProfileProvider({ children }: { children: ReactNode }) {
  const database = useDatabase();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(
    (): Promise<void> =>
      createProfileRepository(database)
        .get()
        .then((profile) => setState({ status: 'ready', profile }))
        .catch((error: unknown) => {
          logger.error('profile', 'profile loading failed', error);
          setState({ status: 'error' });
        }),
    [database],
  );

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<ProfileContextValue | null>(() => {
    if (state.status !== 'ready') return null;
    return {
      profile: state.profile,
      setProfile: (profile) => setState({ status: 'ready', profile }),
      refresh: load,
    };
  }, [load, state]);

  if (state.status === 'loading') {
    return (
      <View
        style={[styles.state, { backgroundColor: colors.background }]}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={colors.primary} />
        <AppText color="secondary">{t('profile.loading')}</AppText>
      </View>
    );
  }

  if (state.status === 'error' || !value) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <ErrorState
          title={t('profile.loadErrorTitle')}
          body={t('profile.loadErrorBody')}
          onRetry={retry}
        />
      </View>
    );
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside ProfileProvider');
  return context;
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
