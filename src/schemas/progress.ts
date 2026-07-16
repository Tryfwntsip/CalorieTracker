import { z } from 'zod';

import { dayKeySchema } from '@/schemas/common';

const nullableMetric = z.number().nonnegative().nullable();

export const nutritionAggregateSchema = z.object({
  dayDate: dayKeySchema,
  energyKcal: z.number().nonnegative(),
  proteinG: nullableMetric,
  carbsG: nullableMetric,
  fatG: nullableMetric,
  calorieTarget: z.number().positive().nullable(),
});

export const weightAggregateSchema = z.object({
  dayDate: dayKeySchema,
  weightKg: z.number().positive(),
});

export const waterAggregateSchema = z.object({
  dayDate: dayKeySchema,
  amountMl: z.number().int().nonnegative(),
});

export const stepsAggregateSchema = z.object({
  dayDate: dayKeySchema,
  steps: z.number().int().nonnegative(),
});

export type NutritionAggregate = z.infer<typeof nutritionAggregateSchema>;
export type WeightAggregate = z.infer<typeof weightAggregateSchema>;
export type WaterAggregate = z.infer<typeof waterAggregateSchema>;
export type StepsAggregate = z.infer<typeof stepsAggregateSchema>;
