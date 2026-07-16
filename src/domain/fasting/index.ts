import type { FastingPlan, FastingSession } from '@/types';

export type FastingKind = '12_12' | '14_10' | '16_8' | '18_6' | '20_4' | '5_2' | 'adf' | 'custom';

export const fastingPresets: Readonly<
  Record<
    Exclude<FastingKind, 'custom'>,
    { fastingMinutes: number; eatingMinutes: number; defaultWeekdays: readonly number[] }
  >
> = {
  '12_12': { fastingMinutes: 720, eatingMinutes: 720, defaultWeekdays: [] },
  '14_10': { fastingMinutes: 840, eatingMinutes: 600, defaultWeekdays: [] },
  '16_8': { fastingMinutes: 960, eatingMinutes: 480, defaultWeekdays: [] },
  '18_6': { fastingMinutes: 1080, eatingMinutes: 360, defaultWeekdays: [] },
  '20_4': { fastingMinutes: 1200, eatingMinutes: 240, defaultWeekdays: [] },
  '5_2': { fastingMinutes: 1440, eatingMinutes: 8640, defaultWeekdays: [1, 4] },
  adf: { fastingMinutes: 1440, eatingMinutes: 1440, defaultWeekdays: [] },
};

export function targetEndAt(startedAt: string, fastingMinutes: number): string {
  return new Date(new Date(startedAt).getTime() + fastingMinutes * 60_000).toISOString();
}

export function elapsedMinutes(startedAt: string, endedAt: string): number {
  return Math.max(
    0,
    Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000),
  );
}

export function fastingProgress(
  session: Pick<FastingSession, 'startedAt' | 'targetEndAt'>,
  now: string,
): number {
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.targetEndAt).getTime();
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (new Date(now).getTime() - start) / (end - start)));
}

export function completedFastingStreak(
  sessions: readonly Pick<FastingSession, 'status' | 'endedAt'>[],
  now: string,
): number {
  const completedDays = new Set(
    sessions
      .filter((session) => session.status === 'completed' && session.endedAt !== null)
      .map((session) => session.endedAt!.slice(0, 10)),
  );
  const cursor = new Date(`${now.slice(0, 10)}T00:00:00.000Z`);
  if (!completedDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (completedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function isReducedTargetDay(plan: FastingPlan, dayDate: string): boolean {
  if (plan.kind === '5_2') {
    return plan.fastingWeekdays.includes(new Date(`${dayDate}T00:00:00.000Z`).getUTCDay());
  }
  if (plan.kind === 'adf') {
    const dayNumber = Math.floor(new Date(`${dayDate}T00:00:00.000Z`).getTime() / 86_400_000);
    return dayNumber % 2 === 0;
  }
  return false;
}

export function fastingAdjustedTarget(
  baseTarget: number,
  plan: FastingPlan | null,
  dayDate: string,
): number {
  if (!plan || !plan.isActive || !isReducedTargetDay(plan, dayDate)) return baseTarget;
  return Math.max(1200, Math.round((baseTarget * plan.reducedTargetPercent) / 100));
}
