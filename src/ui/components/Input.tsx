import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing, typography } from '@/ui/tokens';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  helper?: string;
};

export function Input({ label, error, helper, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <AppText variant="label" color="secondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textDisabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
        style={[
          styles.input,
          typography.body,
          {
            backgroundColor: colors.surface,
            borderColor,
            color: colors.textPrimary,
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="secondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
