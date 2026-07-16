import { z } from 'zod';

import { dayKeySchema, isoTimestampSchema } from '@/schemas/common';

export const profileSchema = z.object({
  id: z.literal(1),
  dateOfBirth: dayKeySchema.nullable(),
  sex: z.enum(['male', 'female', 'unspecified']),
  heightCm: z.number().positive().nullable(),
  currentWeightKg: z.number().positive().nullable(),
  targetWeightKg: z.number().positive().nullable(),
  activityLevel: z.number().int().min(1).max(5).nullable(),
  goalType: z.enum(['lose', 'maintain', 'gain', 'build_muscle']).nullable(),
  weeklyRateKg: z.number().nullable(),
  calorieTarget: z.number().int().positive().nullable(),
  proteinTargetG: z.number().int().nonnegative().nullable(),
  carbsTargetG: z.number().int().nonnegative().nullable(),
  fatTargetG: z.number().int().nonnegative().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const profileGoalHistorySchema = z.object({
  version: z.number().int().positive(),
  profileId: z.literal(1),
  effectiveAt: isoTimestampSchema,
  goalType: z.enum(['lose', 'maintain', 'gain', 'build_muscle']).nullable(),
  weeklyRateKg: z.number().nullable(),
  currentWeightKg: z.number().positive().nullable(),
  targetWeightKg: z.number().positive().nullable(),
  activityLevel: z.number().int().min(1).max(5).nullable(),
  calorieTarget: z.number().int().positive().nullable(),
  proteinTargetG: z.number().int().nonnegative().nullable(),
  carbsTargetG: z.number().int().nonnegative().nullable(),
  fatTargetG: z.number().int().nonnegative().nullable(),
  createdAt: isoTimestampSchema,
});
