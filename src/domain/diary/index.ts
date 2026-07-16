import type { DiaryEntry, ExerciseLog } from '@/types';

export type WeekdayCalorieOverrides = Partial<
  Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', number>
>;

export type DiaryTotals = {
  consumedKcal: number;
  burnedKcal: number;
  remainingKcal: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function weekdayOfDayKey(dayKey: string): keyof WeekdayCalorieOverrides {
  const [year, month, day] = dayKey.split('-').map(Number);
  return String(
    new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay(),
  ) as keyof WeekdayCalorieOverrides;
}

export function effectiveCalorieTarget(
  dayKey: string,
  baseTarget: number,
  overrides: WeekdayCalorieOverrides | null,
): number {
  return overrides?.[weekdayOfDayKey(dayKey)] ?? baseTarget;
}

export function calculateDiaryTotals(
  entries: readonly DiaryEntry[],
  exercises: readonly ExerciseLog[],
  targetKcal: number,
): DiaryTotals {
  const activeEntries = entries.filter((entry) => entry.deletedAt === null);
  const consumedKcal = sum(activeEntries.map((entry) => entry.energyKcal));
  const burnedKcal = sum(exercises.map((exercise) => exercise.energyKcal));

  return {
    consumedKcal,
    burnedKcal,
    remainingKcal: targetKcal + burnedKcal - consumedKcal,
    targetKcal,
    proteinG: sum(activeEntries.map((entry) => entry.proteinG)),
    carbsG: sum(activeEntries.map((entry) => entry.carbsG)),
    fatG: sum(activeEntries.map((entry) => entry.fatG)),
  };
}
