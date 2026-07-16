import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

/** Standard scrollable screen container with themed background. */
export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },
});
