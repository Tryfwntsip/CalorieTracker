import { z } from 'zod';

import { dayKeySchema } from '@/schemas/common';

function decimalText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((value) => Number(value.replace(',', '.')))
    .pipe(z.number().finite().min(min).max(max));
}

function integerText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((value) => Number(value))
    .pipe(z.number().int().min(min).max(max));
}

const optionalWeightText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value.replace(',', '.'))))
  .pipe(z.number().finite().min(30).max(350).nullable());

export const profileBodyInputSchema = z.object({
  dateOfBirth: dayKeySchema,
  sex: z.enum(['male', 'female', 'unspecified']),
  heightCm: decimalText(100, 250),
  currentWeightKg: decimalText(30, 350),
  activityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

export const profileGoalInputSchema = z.object({
  targetWeightKg: optionalWeightText,
  goalType: z.enum(['lose', 'maintain', 'gain', 'build_muscle']),
  weeklyPaceKg: decimalText(0, 5),
});

export const profileTargetInputSchema = z.object({
  calorieTarget: integerText(500, 10000),
  proteinTargetG: integerText(0, 1000),
  carbsTargetG: integerText(0, 1500),
  fatTargetG: integerText(0, 1000),
});

export const profileCalculationInputSchema = profileBodyInputSchema.merge(profileGoalInputSchema);
export const profileSubmissionInputSchema =
  profileCalculationInputSchema.merge(profileTargetInputSchema);

export type ProfileCalculationForm = z.input<typeof profileCalculationInputSchema>;
export type ProfileSubmissionForm = z.input<typeof profileSubmissionInputSchema>;
