import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'leaf-outline', title, body, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textDisabled} />
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color="secondary" style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  center: { textAlign: 'center' },
});
