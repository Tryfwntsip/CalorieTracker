import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

type Props = {
  title?: string;
  body?: string;
  onRetry?: () => void;
};

export function ErrorState({ title, body, onRetry }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <AppText variant="headline" style={styles.center}>
        {title ?? t('errors.genericTitle')}
      </AppText>
      <AppText variant="body" color="secondary" style={styles.center}>
        {body ?? t('errors.genericBody')}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="secondary" /> : null}
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
