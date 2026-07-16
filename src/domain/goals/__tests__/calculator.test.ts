import {
  calculateBmrKcal,
  calculateMacroTargets,
  calculateTargets,
  signedWeeklyRate,
} from '@/domain/goals';

describe('goal calculator', () => {
  it.each([
    ['male', 1780],
    ['female', 1614],
    ['unspecified', 1697],
  ] as const)('calculates Mifflin–St Jeor BMR for %s', (sex, expected) => {
    expect(calculateBmrKcal(sex, 30, 180, 80)).toBe(expected);
  });

  it('uses the exact average of male and female equations for unspecified sex', () => {
    const male = calculateBmrKcal('male', 41, 168, 72);
    const female = calculateBmrKcal('female', 41, 168, 72);
    expect(calculateBmrKcal('unspecified', 41, 168, 72)).toBe((male + female) / 2);
  });

  it.each([
    ['lose', 0.5, -0.5],
    ['maintain', 0.5, 0],
    ['gain', 0.5, 0.5],
    ['build_muscle', -0.25, 0.25],
  ] as const)('normalizes the %s weekly pace', (goalType, pace, expected) => {
    expect(signedWeeklyRate(goalType, pace)).toBe(expected);
  });

  it('calculates maintenance and adjusted energy targets deterministically', () => {
    expect(
      calculateTargets({
        age: 30,
        sex: 'male',
        heightCm: 180,
        currentWeightKg: 80,
        activityLevel: 3,
        goalType: 'lose',
        weeklyRateKg: -0.5,
      }),
    ).toEqual({
      bmrKcal: 1780,
      maintenanceKcal: 2759,
      calorieTarget: 2209,
      proteinTargetG: 128,
      carbsTargetG: 258,
      fatTargetG: 74,
    });
  });

  it('raises the default protein target for muscle building', () => {
    const maintain = calculateMacroTargets(2400, 80, 'maintain');
    const muscle = calculateMacroTargets(2400, 80, 'build_muscle');
    expect(muscle.proteinTargetG).toBe(144);
    expect(muscle.proteinTargetG).toBeGreaterThan(maintain.proteinTargetG);
  });
});
