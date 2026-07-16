import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/ui/theme';
import { radii, spacing } from '@/ui/tokens';

type Props = ViewProps & {
  onPress?: () => void;
  padded?: boolean;
};

export function Card({ onPress, padded = true, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
    padded && styles.padded,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && styles.pressed]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.85 },
});
