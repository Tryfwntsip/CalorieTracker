import { z } from 'zod';

import { dayKeySchema, isoTimestampSchema } from '@/schemas/common';

export const mealPlanSchema = z.object({
  id: z.string().min(1),
  weekStart: dayKeySchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const mealPlanEntrySchema = z
  .object({
    id: z.string().min(1),
    planId: z.string().min(1),
    dayDate: dayKeySchema,
    section: z.string().min(1),
    recipeId: z.string().nullable(),
    foodId: z.string().nullable(),
    templateId: z.string().nullable(),
    quantity: z.number().positive(),
    position: z.number().int().nonnegative(),
    label: z.string().min(1),
    labelEl: z.string().nullable(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine(
    ({ recipeId, foodId, templateId }) =>
      [recipeId, foodId, templateId].filter((id) => id !== null).length === 1,
    'A planned entry must reference exactly one item.',
  );
