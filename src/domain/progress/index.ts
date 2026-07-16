import { diffDays, type DayKey } from '@/domain/dates';
import { effectiveCalorieTarget, type WeekdayCalorieOverrides } from '@/domain/diary';
import type {
  NutritionAggregate,
  StepsAggregate,
  WaterAggregate,
  WeightAggregate,
} from '@/schemas/progress';
import type { MoodTagAggregate } from '@/schemas/fasting';
import type { FastingPlan } from '@/types';
import { fastingAdjustedTarget } from '@/domain/fasting';

export type ChartPoint = { dayDate: DayKey; value: number };

export type ProgressAnalysis = {
  caloriePoints: ChartPoint[];
  targetPoints: ChartPoint[];
  weightPoints: ChartPoint[];
  weightTrendPoints: ChartPoint[];
  waterPoints: ChartPoint[];
  stepsPoints: ChartPoint[];
  averageCalories: number | null;
  averageTarget: number | null;
  averageWaterMl: number | null;
  averageSteps: number | null;
  averageProteinG: number | null;
  averageCarbsG: number | null;
  averageFatG: number | null;
  weightChangeKg: number | null;
  estimatedWeeklyWeightChangeKg: number | null;
  calorieDays: number;
  moodPoints: ChartPoint[];
  averageMood: number | null;
  moodTags: MoodTagAggregate[];
};

export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function exponentialMovingAverage(points: readonly ChartPoint[], period = 7): ChartPoint[] {
  if (points.length === 0) return [];
  const alpha = 2 / (period + 1);
  let current = points[0]!.value;
  return points.map((point, index) => {
    if (index > 0) current = alpha * point.value + (1 - alpha) * current;
    return { dayDate: point.dayDate, value: current };
  });
}

export function estimatedWeeklyTrend(points: readonly ChartPoint[]): number | null {
  if (points.length < 2) return null;
  const firstDay = points[0]!.dayDate;
  const xs = points.map((point) => diffDays(firstDay, point.dayDate));
  const meanX = average(xs);
  const meanY = average(points.map((point) => point.value));
  if (meanX === null || meanY === null) return null;
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (denominator === 0) return null;
  const numerator = points.reduce(
    (sum, point, index) => sum + (xs[index]! - meanX) * (point.value - meanY),
    0,
  );
  return (numerator / denominator) * 7;
}

function present(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

export function analyzeProgress(
  nutrition: readonly NutritionAggregate[],
  weights: readonly WeightAggregate[],
  water: readonly WaterAggregate[],
  steps: readonly StepsAggregate[],
  overrides: WeekdayCalorieOverrides | null,
  mood: readonly { dayDate: string; mood: number }[] = [],
  moodTags: readonly MoodTagAggregate[] = [],
  activeFastingPlan: FastingPlan | null = null,
): ProgressAnalysis {
  const caloriePoints = nutrition.map(({ dayDate, energyKcal }) => ({
    dayDate,
    value: energyKcal,
  }));
  const targetPoints = nutrition.flatMap(({ dayDate, calorieTarget }) =>
    calorieTarget === null
      ? []
      : [
          {
            dayDate,
            value: fastingAdjustedTarget(
              effectiveCalorieTarget(dayDate, calorieTarget, overrides),
              activeFastingPlan,
              dayDate,
            ),
          },
        ],
  );
  const weightPoints = weights.map(({ dayDate, weightKg }) => ({ dayDate, value: weightKg }));
  const waterPoints = water.map(({ dayDate, amountMl }) => ({ dayDate, value: amountMl }));
  const stepsPoints = steps.map(({ dayDate, steps: value }) => ({ dayDate, value }));
  const moodPoints = mood.map(({ dayDate, mood: value }) => ({ dayDate, value }));

  return {
    caloriePoints,
    targetPoints,
    weightPoints,
    weightTrendPoints: exponentialMovingAverage(weightPoints),
    waterPoints,
    stepsPoints,
    averageCalories: average(caloriePoints.map(({ value }) => value)),
    averageTarget: average(targetPoints.map(({ value }) => value)),
    averageWaterMl: average(waterPoints.map(({ value }) => value)),
    averageSteps: average(stepsPoints.map(({ value }) => value)),
    averageProteinG: average(present(nutrition.map(({ proteinG }) => proteinG))),
    averageCarbsG: average(present(nutrition.map(({ carbsG }) => carbsG))),
    averageFatG: average(present(nutrition.map(({ fatG }) => fatG))),
    weightChangeKg:
      weightPoints.length < 2 ? null : weightPoints.at(-1)!.value - weightPoints[0]!.value,
    estimatedWeeklyWeightChangeKg: estimatedWeeklyTrend(weightPoints),
    calorieDays: nutrition.length,
    moodPoints,
    averageMood: average(moodPoints.map(({ value }) => value)),
    moodTags: [...moodTags],
  };
}
