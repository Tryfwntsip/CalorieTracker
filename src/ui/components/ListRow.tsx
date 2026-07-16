import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, spacing } from '@/ui/tokens';

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
};

export function ListRow({ title, subtitle, left, right, onPress, testID }: Props) {
  const { colors } = useTheme();

  const content = (
    <>
      {left ? <View style={styles.side}>{left}</View> : null}
      <View style={styles.body}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.side}>{right}</View> : null}
    </>
  );

  const rowStyle = [styles.row, { borderBottomColor: colors.border }];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={rowStyle} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing.xxs },
  side: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
