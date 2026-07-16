import {
  completedFastingStreak,
  elapsedMinutes,
  fastingAdjustedTarget,
  fastingProgress,
  isReducedTargetDay,
  targetEndAt,
} from '@/domain/fasting';
import type { FastingPlan } from '@/types';

const plan = (overrides: Partial<FastingPlan> = {}): FastingPlan => ({
  id: 'plan',
  kind: '5_2',
  name: '5:2',
  fastingMinutes: 1440,
  eatingMinutes: 8640,
  startTime: '20:00',
  fastingWeekdays: [1, 4],
  reducedTargetPercent: 75,
  notificationsEnabled: false,
  isActive: true,
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
  ...overrides,
});

describe('fasting domain', () => {
  it('computes elapsed windows by absolute time across midnight and DST offsets', () => {
    expect(targetEndAt('2026-07-16T20:00:00.000Z', 960)).toBe('2026-07-17T12:00:00.000Z');
    expect(elapsedMinutes('2026-03-29T00:30:00.000+02:00', '2026-03-29T04:30:00.000+03:00')).toBe(
      180,
    );
  });

  it('clamps timer progress', () => {
    const session = {
      startedAt: '2026-07-16T08:00:00.000Z',
      targetEndAt: '2026-07-16T12:00:00.000Z',
    };
    expect(fastingProgress(session, '2026-07-16T07:00:00.000Z')).toBe(0);
    expect(fastingProgress(session, '2026-07-16T10:00:00.000Z')).toBe(0.5);
    expect(fastingProgress(session, '2026-07-16T13:00:00.000Z')).toBe(1);
  });

  it('counts consecutive completed days while ignoring an active session', () => {
    expect(
      completedFastingStreak(
        [
          { status: 'active', endedAt: null },
          { status: 'completed', endedAt: '2026-07-15T12:00:00.000Z' },
          { status: 'completed', endedAt: '2026-07-14T12:00:00.000Z' },
          { status: 'cancelled', endedAt: '2026-07-13T12:00:00.000Z' },
        ],
        '2026-07-16T08:00:00.000Z',
      ),
    ).toBe(2);
  });

  it('applies 5:2 and alternate-day reductions without crossing the calorie safety floor', () => {
    expect(isReducedTargetDay(plan(), '2026-07-13')).toBe(true);
    expect(isReducedTargetDay(plan(), '2026-07-14')).toBe(false);
    expect(fastingAdjustedTarget(2000, plan(), '2026-07-13')).toBe(1500);
    expect(fastingAdjustedTarget(1400, plan(), '2026-07-13')).toBe(1200);
    expect(fastingAdjustedTarget(2000, plan({ kind: 'adf' }), '2026-07-16')).not.toBe(
      fastingAdjustedTarget(2000, plan({ kind: 'adf' }), '2026-07-17'),
    );
  });
});
