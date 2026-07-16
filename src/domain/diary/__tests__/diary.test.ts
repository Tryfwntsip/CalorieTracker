import { calculateDiaryTotals, effectiveCalorieTarget, weekdayOfDayKey } from '@/domain/diary';
import type { DiaryEntry, ExerciseLog } from '@/types';

const entry = (values: Partial<DiaryEntry>): DiaryEntry => ({
  id: 'entry',
  dayDate: '2026-07-16',
  section: 'lunch',
  foodId: null,
  customLabel: 'Lunch',
  quantity: 1,
  unit: 'serving',
  gramsResolved: null,
  energyKcal: 500,
  proteinG: 30,
  carbsG: 50,
  fatG: 20,
  satFatG: null,
  fiberG: null,
  sugarG: null,
  sodiumMg: null,
  microsSnapshot: null,
  loggedVia: 'manual',
  deletedAt: null,
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
  ...values,
});

const exercise: ExerciseLog = {
  id: 'exercise',
  dayDate: '2026-07-16',
  activityType: 'Walk',
  durationMinutes: 30,
  energyKcal: 150,
  origin: 'manual',
  externalUid: null,
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

describe('diary calculations', () => {
  it.each([
    ['2026-07-12', '0'],
    ['2026-07-13', '1'],
    ['2026-07-16', '4'],
    ['2026-07-18', '6'],
  ] as const)('resolves %s to weekday %s', (dayKey, weekday) => {
    expect(weekdayOfDayKey(dayKey)).toBe(weekday);
  });

  it('uses an override only for the matching weekday', () => {
    expect(effectiveCalorieTarget('2026-07-16', 2000, { '4': 2300 })).toBe(2300);
    expect(effectiveCalorieTarget('2026-07-17', 2000, { '4': 2300 })).toBe(2000);
  });

  it('calculates consumed, burned, remaining, and macros while ignoring tombstones', () => {
    expect(
      calculateDiaryTotals(
        [
          entry({}),
          entry({ id: 'deleted', energyKcal: 999, deletedAt: '2026-07-16T09:00:00.000Z' }),
        ],
        [exercise],
        2000,
      ),
    ).toEqual({
      consumedKcal: 500,
      burnedKcal: 150,
      remainingKcal: 1650,
      targetKcal: 2000,
      proteinG: 30,
      carbsG: 50,
      fatG: 20,
    });
  });
});
