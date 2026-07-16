import { PROTEIN_FLOOR_G_PER_KG } from '@/domain/goals/calculator';
import type { GoalType } from '@/domain/goals/types';

export const BLOCKED_CALORIE_TARGET = 1200;
export const CONFIRM_CALORIE_TARGET_MAX = 1500;
export const BLOCKED_WEEKLY_LOSS_PERCENT = 0.015;
export const CONFIRM_WEEKLY_CHANGE_KG = 0.75;
export const BLOCKED_GOAL_BMI = 17;
export const CONFIRM_GOAL_BMI_MAX = 18.5;

export type BlockedReason = 'calories_too_low' | 'loss_rate_too_high' | 'goal_bmi_too_low';
export type ConfirmationReason = 'calories_low' | 'weekly_change_aggressive' | 'goal_bmi_low';

export type GuardrailResult = {
  status: 'safe' | 'confirmation_required' | 'blocked';
  blockedReasons: BlockedReason[];
  confirmationReasons: ConfirmationReason[];
};

export type GuardrailInput = {
  calorieTarget: number;
  currentWeightKg: number;
  targetWeightKg: number | null;
  heightCm: number;
  goalType: GoalType;
  weeklyRateKg: number;
};

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function evaluateGuardrails(input: GuardrailInput): GuardrailResult {
  const blockedReasons: BlockedReason[] = [];
  const confirmationReasons: ConfirmationReason[] = [];

  if (input.calorieTarget < BLOCKED_CALORIE_TARGET) {
    blockedReasons.push('calories_too_low');
  } else if (input.calorieTarget <= CONFIRM_CALORIE_TARGET_MAX) {
    confirmationReasons.push('calories_low');
  }

  const weeklyMagnitude = Math.abs(input.weeklyRateKg);
  if (
    input.goalType === 'lose' &&
    weeklyMagnitude > input.currentWeightKg * BLOCKED_WEEKLY_LOSS_PERCENT
  ) {
    blockedReasons.push('loss_rate_too_high');
  } else if (weeklyMagnitude > CONFIRM_WEEKLY_CHANGE_KG) {
    confirmationReasons.push('weekly_change_aggressive');
  }

  if (input.targetWeightKg !== null) {
    const goalBmi = bmi(input.targetWeightKg, input.heightCm);
    if (goalBmi < BLOCKED_GOAL_BMI) {
      blockedReasons.push('goal_bmi_too_low');
    } else if (goalBmi <= CONFIRM_GOAL_BMI_MAX) {
      confirmationReasons.push('goal_bmi_low');
    }
  }

  return {
    status:
      blockedReasons.length > 0
        ? 'blocked'
        : confirmationReasons.length > 0
          ? 'confirmation_required'
          : 'safe',
    blockedReasons,
    confirmationReasons,
  };
}

export function minimumProteinTargetG(currentWeightKg: number): number {
  return Math.ceil(currentWeightKg * PROTEIN_FLOOR_G_PER_KG);
}
