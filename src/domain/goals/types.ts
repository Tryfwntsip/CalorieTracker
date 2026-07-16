export type BiologicalSex = 'male' | 'female' | 'unspecified';
export type GoalType = 'lose' | 'maintain' | 'gain' | 'build_muscle';
export type ActivityLevel = 1 | 2 | 3 | 4 | 5;

export type TargetCalculationInput = {
  age: number;
  sex: BiologicalSex;
  heightCm: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  /** Signed kg/week: negative for loss, positive for gain, zero for maintenance. */
  weeklyRateKg: number;
};

export type MacroTargets = {
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
};

export type TargetCalculation = MacroTargets & {
  bmrKcal: number;
  maintenanceKcal: number;
  calorieTarget: number;
};
