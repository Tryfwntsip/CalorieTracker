import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  testID,
}: Props) {
  const { colors } = useTheme();
  const isInert = disabled || loading;

  const container: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.primarySoft },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.dangerSoft },
  };
  const textColor = {
    primary: 'onPrimary' as const,
    secondary: 'accent' as const,
    ghost: 'accent' as const,
    danger: 'danger' as const,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
      disabled={isInert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        container[variant],
        fullWidth && styles.fullWidth,
        pressed && !isInert && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.onPrimary : colors.primary}
          testID={testID ? `${testID}-spinner` : undefined}
        />
      ) : (
        <AppText variant="bodyStrong" color={disabled ? 'disabled' : textColor}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
