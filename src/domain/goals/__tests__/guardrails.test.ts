import {
  bmi,
  evaluateGuardrails,
  minimumProteinTargetG,
  type GuardrailInput,
} from '@/domain/goals';

const safeInput: GuardrailInput = {
  calorieTarget: 2000,
  currentWeightKg: 80,
  targetWeightKg: 70,
  heightCm: 175,
  goalType: 'lose',
  weeklyRateKg: -0.5,
};

describe('goal safety guardrails', () => {
  it.each([
    [1199, 'blocked'],
    [1200, 'confirmation_required'],
    [1500, 'confirmation_required'],
    [1501, 'safe'],
  ] as const)('classifies a %i kcal target as %s', (calorieTarget, status) => {
    expect(evaluateGuardrails({ ...safeInput, calorieTarget, weeklyRateKg: 0 }).status).toBe(
      status,
    );
  });

  it('blocks loss above 1.5% of current body weight, but not at the boundary', () => {
    const boundary = evaluateGuardrails({ ...safeInput, weeklyRateKg: -1.2 });
    const over = evaluateGuardrails({ ...safeInput, weeklyRateKg: -1.201 });
    expect(boundary.blockedReasons).not.toContain('loss_rate_too_high');
    expect(over.blockedReasons).toContain('loss_rate_too_high');
  });

  it('requires confirmation above 0.75 kg/week', () => {
    expect(evaluateGuardrails({ ...safeInput, goalType: 'gain', weeklyRateKg: 0.75 }).status).toBe(
      'safe',
    );
    expect(
      evaluateGuardrails({ ...safeInput, goalType: 'gain', weeklyRateKg: 0.751 })
        .confirmationReasons,
    ).toContain('weekly_change_aggressive');
  });

  it.each([
    [16.99, 'blocked'],
    [17, 'confirmation_required'],
    [18.5, 'confirmation_required'],
    [18.51, 'safe'],
  ] as const)('classifies a goal BMI of %f as %s', (goalBmi, status) => {
    const heightCm = 180;
    const targetWeightKg = goalBmi * (heightCm / 100) ** 2;
    expect(
      evaluateGuardrails({
        ...safeInput,
        targetWeightKg,
        heightCm,
        weeklyRateKg: 0,
      }).status,
    ).toBe(status);
  });

  it('calculates BMI and the explicit protein floor', () => {
    expect(bmi(81, 180)).toBeCloseTo(25);
    expect(minimumProteinTargetG(73)).toBe(59);
  });

  it('returns every applicable reason while blocked takes precedence', () => {
    const result = evaluateGuardrails({
      calorieTarget: 1100,
      currentWeightKg: 60,
      targetWeightKg: 45,
      heightCm: 175,
      goalType: 'lose',
      weeklyRateKg: -1,
    });
    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toEqual([
      'calories_too_low',
      'loss_rate_too_high',
      'goal_bmi_too_low',
    ]);
    expect(result.confirmationReasons).toEqual([]);
  });
});
