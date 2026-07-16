import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/ui/theme';
import { typography, type TypographyToken } from '@/ui/tokens';

type Props = TextProps & {
  variant?: TypographyToken;
  color?: 'primary' | 'secondary' | 'disabled' | 'accent' | 'danger' | 'onPrimary';
};

export function AppText({ variant = 'body', color = 'primary', style, ...rest }: Props) {
  const { colors } = useTheme();
  const colorValue = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    disabled: colors.textDisabled,
    accent: colors.primary,
    danger: colors.danger,
    onPrimary: colors.onPrimary,
  }[color];

  return <Text {...rest} style={[typography[variant], { color: colorValue }, style]} />;
}
