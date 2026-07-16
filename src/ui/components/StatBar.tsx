import { StyleSheet, View } from 'react-native';

import { clampProgress } from '@/ui/components/ProgressRing';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme';
import { radii, spacing } from '@/ui/tokens';

type Props = {
  label: string;
  /** e.g. "82 / 120 g" — caller formats units so this stays dumb. */
  valueText: string;
  /** 0..1; clamped. */
  progress: number;
  color?: string;
  testID?: string;
};

/** Labeled horizontal progress bar (macros, water, etc.). */
export function StatBar({ label, valueText, progress, color, testID }: Props) {
  const { colors } = useTheme();
  const clamped = clampProgress(progress);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${valueText}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID}
    >
      <View style={styles.labels}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="label" color="secondary">
          {valueText}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={[
            styles.fill,
            { backgroundColor: color ?? colors.primary, width: `${clamped * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radii.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full },
});
