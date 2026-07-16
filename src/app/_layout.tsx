import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { initI18n } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { ThemeProvider, useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n()
      .catch((error: unknown) => {
        // i18next falls back to English defaults; the app must still open.
        logger.error('i18n', 'initialization failed', error);
      })
      .finally(() => {
        setReady(true);
        void SplashScreen.hideAsync();
      });
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseProvider>
          <RootNavigator />
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
