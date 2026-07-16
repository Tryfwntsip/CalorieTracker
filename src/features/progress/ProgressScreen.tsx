import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { dayKeyOf } from '@/domain/dates';
import type { ChartPoint, ProgressAnalysis } from '@/domain/progress';
import { AppText, Card, EmptyState, ErrorState, Screen, StatBar } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { ProgressChart } from './ProgressChart';
import { progressRanges, type ProgressRange, useProgressData } from './useProgressData';

type Props = { now?: Date };

function rounded(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

function signed(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function chartDates(points: readonly ChartPoint[], fallbackStart: string, fallbackEnd: string) {
  return {
    start: points[0]?.dayDate ?? fallbackStart,
    end: points.at(-1)?.dayDate ?? fallbackEnd,
  };
}

function shortDate(dayKey: string, locale: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function DataLabel({ label, tone = 'recorded' }: { label: string; tone?: 'recorded' | 'other' }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.dataLabel,
        { backgroundColor: tone === 'recorded' ? colors.primarySoft : colors.warningSoft },
      ]}
    >
      <AppText variant="caption" color={tone === 'recorded' ? 'accent' : 'warning'}>
        {label}
      </AppText>
    </View>
  );
}

function ChartCard({
  title,
  summary,
  points,
  comparison,
  fromDay,
  toDay,
  labels,
}: {
  title: string;
  summary: string;
  points: readonly ChartPoint[];
  comparison?: readonly ChartPoint[];
  fromDay: string;
  toDay: string;
  labels: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const dates = chartDates(points, fromDay, toDay);
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeading}>
        <AppText variant="headline">{title}</AppText>
        <View style={styles.labels}>{labels}</View>
      </View>
      <AppText color="secondary">{summary}</AppText>
      {points.length > 0 ? (
        <ProgressChart
          points={points}
          comparison={comparison}
          accessibilityLabel={`${title}. ${summary}`}
          startLabel={shortDate(dates.start, i18n.language)}
          endLabel={shortDate(dates.end, i18n.language)}
        />
      ) : (
        <AppText color="secondary">{t('progress.noDataForMetric')}</AppText>
      )}
    </Card>
  );
}

function ProgressContent({
  analysis,
  fromDay,
  toDay,
}: {
  analysis: ProgressAnalysis;
  fromDay: string;
  toDay: string;
}) {
  const { t } = useTranslation();
  const hasAnyData =
    analysis.caloriePoints.length +
      analysis.weightPoints.length +
      analysis.waterPoints.length +
      analysis.stepsPoints.length >
    0;
  if (!hasAnyData) {
    return <EmptyState title={t('progress.emptyTitle')} body={t('progress.emptyBody')} />;
  }

  const calorieTarget =
    analysis.averageTarget === null
      ? t('progress.averageCaloriesOnly', { calories: rounded(analysis.averageCalories) })
      : t('progress.averageCalories', {
          calories: rounded(analysis.averageCalories),
          target: rounded(analysis.averageTarget),
          days: analysis.calorieDays,
        });
  const macroMaximum = Math.max(
    analysis.averageProteinG ?? 0,
    analysis.averageCarbsG ?? 0,
    analysis.averageFatG ?? 0,
    1,
  );

  return (
    <>
      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <AppText variant="caption" color="secondary">
            {t('progress.averageCaloriesLabel')}
          </AppText>
          <AppText variant="title">{rounded(analysis.averageCalories)}</AppText>
          <AppText variant="caption">{t('progress.units.kcal')}</AppText>
        </Card>
        <Card style={styles.summaryCard}>
          <AppText variant="caption" color="secondary">
            {t('progress.weightChange')}
          </AppText>
          <AppText variant="title">{signed(analysis.weightChangeKg)}</AppText>
          <AppText variant="caption">{t('progress.units.kg')}</AppText>
        </Card>
      </View>

      <ChartCard
        title={t('progress.caloriesTitle')}
        summary={calorieTarget}
        points={analysis.caloriePoints}
        comparison={analysis.targetPoints}
        fromDay={fromDay}
        toDay={toDay}
        labels={
          <>
            <DataLabel label={t('progress.recorded')} />
            <DataLabel label={t('progress.calculatedTarget')} tone="other" />
          </>
        }
      />

      <ChartCard
        title={t('progress.weightTitle')}
        summary={t('progress.weightSummary', {
          change: signed(analysis.weightChangeKg),
          weekly: signed(analysis.estimatedWeeklyWeightChangeKg),
        })}
        points={analysis.weightPoints}
        comparison={analysis.weightTrendPoints}
        fromDay={fromDay}
        toDay={toDay}
        labels={
          <>
            <DataLabel label={t('progress.recorded')} />
            <DataLabel label={t('progress.calculatedTrend')} tone="other" />
            <DataLabel label={t('progress.estimatedRate')} tone="other" />
          </>
        }
      />

      <Card style={styles.card}>
        <View style={styles.cardHeading}>
          <AppText variant="headline">{t('progress.macrosTitle')}</AppText>
          <View style={styles.labels}>
            <DataLabel label={t('progress.recorded')} />
            <DataLabel label={t('progress.calculatedAverage')} tone="other" />
          </View>
        </View>
        <AppText color="secondary">{t('progress.loggedDayAverage')}</AppText>
        <StatBar
          label={t('diary.protein')}
          valueText={`${rounded(analysis.averageProteinG, 1)} ${t('progress.units.g')}`}
          progress={(analysis.averageProteinG ?? 0) / macroMaximum}
        />
        <StatBar
          label={t('diary.carbs')}
          valueText={`${rounded(analysis.averageCarbsG, 1)} ${t('progress.units.g')}`}
          progress={(analysis.averageCarbsG ?? 0) / macroMaximum}
        />
        <StatBar
          label={t('diary.fat')}
          valueText={`${rounded(analysis.averageFatG, 1)} ${t('progress.units.g')}`}
          progress={(analysis.averageFatG ?? 0) / macroMaximum}
        />
      </Card>

      <ChartCard
        title={t('progress.waterTitle')}
        summary={t('progress.waterSummary', { amount: rounded(analysis.averageWaterMl) })}
        points={analysis.waterPoints}
        fromDay={fromDay}
        toDay={toDay}
        labels={
          <>
            <DataLabel label={t('progress.recorded')} />
            <DataLabel label={t('progress.calculatedAverage')} tone="other" />
          </>
        }
      />

      <ChartCard
        title={t('progress.stepsTitle')}
        summary={t('progress.stepsSummary', { steps: rounded(analysis.averageSteps) })}
        points={analysis.stepsPoints}
        fromDay={fromDay}
        toDay={toDay}
        labels={
          <>
            <DataLabel label={t('progress.recorded')} />
            <DataLabel label={t('progress.calculatedAverage')} tone="other" />
          </>
        }
      />
    </>
  );
}

export function ProgressScreen({ now = new Date() }: Props) {
  const [range, setRange] = useState<ProgressRange>('month');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = useMemo(() => dayKeyOf(now), [now]);
  const progress = useProgressData(today, range);
  const retry = progress.retry;

  useFocusEffect(
    useCallback(() => {
      void retry();
    }, [retry]),
  );

  return (
    <Screen>
      <View>
        <AppText variant="title">{t('progress.title')}</AppText>
        <AppText color="secondary">{t('progress.subtitle')}</AppText>
      </View>
      <View style={styles.ranges}>
        {(Object.keys(progressRanges) as ProgressRange[]).map((option) => {
          const selected = range === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setRange(option)}
              style={[
                styles.range,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText variant="label" color={selected ? 'onPrimary' : 'primary'}>
                {t(`progress.ranges.${option}`)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {progress.state.status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText color="secondary">{t('progress.loading')}</AppText>
        </View>
      ) : progress.state.status === 'error' ? (
        <ErrorState
          title={t('progress.errorTitle')}
          body={t('progress.errorBody')}
          onRetry={() => void retry()}
        />
      ) : (
        <ProgressContent
          analysis={progress.state.analysis}
          fromDay={progress.state.fromDay}
          toDay={progress.state.toDay}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  range: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  summaryGrid: { flexDirection: 'row', gap: spacing.md },
  summaryCard: { flex: 1, gap: spacing.xs },
  card: { gap: spacing.md },
  cardHeading: { gap: spacing.sm },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dataLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
});
