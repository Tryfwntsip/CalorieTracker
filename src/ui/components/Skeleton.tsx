import { useEffect, useState } from 'react';
import { Animated, type DimensionValue } from 'react-native';

import { useTheme } from '@/ui/theme';
import { radii } from '@/ui/tokens';

type Props = {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
  testID?: string;
};

export function Skeleton({ width = '100%', height = 16, round = false, testID }: Props) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        opacity,
        borderRadius: round ? radii.full : radii.sm,
        backgroundColor: colors.skeleton,
      }}
    />
  );
}
