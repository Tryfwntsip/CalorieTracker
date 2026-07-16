import type {
  ActivityLevel,
  BiologicalSex,
  GoalType,
  MacroTargets,
  TargetCalculation,
  TargetCalculationInput,
} from '@/domain/goals/types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
};

export const KCAL_PER_KG = 7700;
export const PROTEIN_FLOOR_G_PER_KG = 0.8;

const SEX_CONSTANTS: Record<BiologicalSex, number> = {
  male: 5,
  female: -161,
  // The explicit unspecified fallback is the average of the male/female equations.
  unspecified: -78,
};

const PROTEIN_MULTIPLIERS: Record<GoalType, number> = {
  lose: 1.6,
  maintain: 1.4,
  gain: 1.6,
  build_muscle: 1.8,
};

export function calculateBmrKcal(
  sex: BiologicalSex,
  age: number,
  heightCm: number,
  weightKg: number,
): number {
  // Mifflin–St Jeor equation (Mifflin et al., Am J Clin Nutr, 1990).
  // The unspecified path uses the arithmetic mean of the two published constants.
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANTS[sex];
}

export function signedWeeklyRate(goalType: GoalType, weeklyPaceKg: number): number {
  const magnitude = Math.abs(weeklyPaceKg);
  if (goalType === 'lose') return -magnitude;
  if (goalType === 'maintain') return 0;
  return magnitude;
}

export function calculateMacroTargets(
  calorieTarget: number,
  currentWeightKg: number,
  goalType: GoalType,
): MacroTargets {
  const proteinTargetG = Math.max(
    Math.round(currentWeightKg * PROTEIN_MULTIPLIERS[goalType]),
    Math.ceil(currentWeightKg * PROTEIN_FLOOR_G_PER_KG),
  );
  const fatTargetG = Math.max(0, Math.round((calorieTarget * 0.3) / 9));
  const remainingKcal = calorieTarget - proteinTargetG * 4 - fatTargetG * 9;
  const carbsTargetG = Math.max(0, Math.round(remainingKcal / 4));

  return { proteinTargetG, carbsTargetG, fatTargetG };
}

export function calculateTargets(input: TargetCalculationInput): TargetCalculation {
  const bmrKcal = calculateBmrKcal(input.sex, input.age, input.heightCm, input.currentWeightKg);
  const maintenanceKcal = bmrKcal * ACTIVITY_MULTIPLIERS[input.activityLevel];
  const dailyGoalAdjustment = (input.weeklyRateKg * KCAL_PER_KG) / 7;
  const calorieTarget = Math.round(maintenanceKcal + dailyGoalAdjustment);

  return {
    bmrKcal: Math.round(bmrKcal),
    maintenanceKcal: Math.round(maintenanceKcal),
    calorieTarget,
    ...calculateMacroTargets(calorieTarget, input.currentWeightKg, input.goalType),
  };
}
