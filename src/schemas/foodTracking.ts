import { z } from 'zod';

import { isoTimestampSchema, nullableNonNegativeNumberSchema } from '@/schemas/common';

export const foodOverrideSchema = z.object({
  foodId: z.string().min(1),
  name: z.string().trim().min(1),
  nameEl: z.string().nullable(),
  energyKcal: nullableNonNegativeNumberSchema,
  proteinG: nullableNonNegativeNumberSchema,
  carbsG: nullableNonNegativeNumberSchema,
  fatG: nullableNonNegativeNumberSchema,
  satFatG: nullableNonNegativeNumberSchema,
  fiberG: nullableNonNegativeNumberSchema,
  sugarG: nullableNonNegativeNumberSchema,
  saltG: nullableNonNegativeNumberSchema,
  sodiumMg: nullableNonNegativeNumberSchema,
  updatedAt: isoTimestampSchema,
});

export const foodFavoriteSchema = z.object({
  foodId: z.string().min(1),
  createdAt: isoTimestampSchema,
});

export const foodRecentSchema = z.object({
  foodId: z.string().min(1),
  lastUsedAt: isoTimestampSchema,
  useCount: z.number().int().positive(),
});

export const mealTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const mealTemplateItemSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  foodId: z.string().min(1),
  grams: z.number().positive(),
  position: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
});

export const foodLogInputSchema = z.object({
  quantity: z.number().positive(),
  grams: z.number().positive(),
  unit: z.enum(['g', 'ml', 'serving', 'piece', 'tsp', 'tbsp']),
});

export const customFoodInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameEl: z.string().trim().max(120).nullable(),
  energyKcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  servingName: z.string().trim().max(60).nullable(),
  servingGrams: z.number().positive().nullable(),
});

export const mealTemplateFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
