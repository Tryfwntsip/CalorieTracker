import {
  analyzeProgress,
  average,
  estimatedWeeklyTrend,
  exponentialMovingAverage,
} from '@/domain/progress';

describe('progress calculations', () => {
  it.each([
    { values: [], expected: null },
    { values: [10], expected: 10 },
    { values: [10, 20, 30], expected: 20 },
  ])('averages $values', ({ values, expected }) => {
    expect(average(values)).toBe(expected);
  });

  it('calculates a deterministic 7-entry exponential moving trend', () => {
    const result = exponentialMovingAverage([
      { dayDate: '2026-07-01', value: 80 },
      { dayDate: '2026-07-02', value: 76 },
      { dayDate: '2026-07-03', value: 72 },
    ]);
    expect(result.map(({ value }) => value)).toEqual([80, 79, 77.25]);
  });

  it('estimates a weekly weight rate using linear regression over elapsed days', () => {
    expect(
      estimatedWeeklyTrend([
        { dayDate: '2026-07-01', value: 80 },
        { dayDate: '2026-07-08', value: 79 },
        { dayDate: '2026-07-15', value: 78 },
      ]),
    ).toBeCloseTo(-1);
    expect(estimatedWeeklyTrend([{ dayDate: '2026-07-01', value: 80 }])).toBeNull();
  });

  it('uses logged-day averages and applies weekday calorie overrides', () => {
    const result = analyzeProgress(
      [
        {
          dayDate: '2026-07-13',
          energyKcal: 1800,
          proteinG: 90,
          carbsG: null,
          fatG: 60,
          calorieTarget: 2000,
        },
        {
          dayDate: '2026-07-14',
          energyKcal: 2200,
          proteinG: 110,
          carbsG: 250,
          fatG: 80,
          calorieTarget: 2000,
        },
      ],
      [
        { dayDate: '2026-07-13', weightKg: 80 },
        { dayDate: '2026-07-14', weightKg: 79.8 },
      ],
      [{ dayDate: '2026-07-13', amountMl: 2000 }],
      [{ dayDate: '2026-07-13', steps: 8000 }],
      { '1': 1900 },
    );

    expect(result.averageCalories).toBe(2000);
    expect(result.averageTarget).toBe(1950);
    expect(result.averageProteinG).toBe(100);
    expect(result.averageCarbsG).toBe(250);
    expect(result.weightChangeKg).toBeCloseTo(-0.2);
  });
});
