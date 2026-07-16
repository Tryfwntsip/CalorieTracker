import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { ChartPoint } from '@/domain/progress';
import { AppText } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { spacing } from '@/ui/tokens';

type Props = {
  points: readonly ChartPoint[];
  comparison?: readonly ChartPoint[];
  accessibilityLabel: string;
  startLabel: string;
  endLabel: string;
};

const WIDTH = 320;
const HEIGHT = 132;
const PADDING = 12;

function pathFor(points: readonly ChartPoint[], minimum: number, maximum: number): string {
  if (points.length === 0) return '';
  const span = Math.max(maximum - minimum, 1);
  const xSpan = WIDTH - PADDING * 2;
  const ySpan = HEIGHT - PADDING * 2;
  return points
    .map((point, index) => {
      const ratio = points.length === 1 ? 0.5 : index / (points.length - 1);
      const x = PADDING + ratio * xSpan;
      const y = HEIGHT - PADDING - ((point.value - minimum) / span) * ySpan;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ProgressChart({
  points,
  comparison = [],
  accessibilityLabel,
  startLabel,
  endLabel,
}: Props) {
  const { colors } = useTheme();
  const values = [...points, ...comparison].map(({ value }) => value);
  if (values.length === 0) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={HEIGHT - PADDING}
          y2={HEIGHT - PADDING}
          stroke={colors.border}
        />
        {comparison.length > 0 ? (
          <Path
            d={pathFor(comparison, minimum, maximum)}
            fill="none"
            stroke={colors.warning}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        ) : null}
        <Path
          d={pathFor(points, minimum, maximum)}
          fill="none"
          stroke={colors.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.axis}>
        <AppText variant="caption" color="secondary">
          {startLabel}
        </AppText>
        <AppText variant="caption" color="secondary">
          {endLabel}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
