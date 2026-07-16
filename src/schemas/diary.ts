import { z } from 'zod';

import {
  dayKeySchema,
  isoTimestampSchema,
  nullableJsonTextSchema,
  nullableNonNegativeNumberSchema,
} from '@/schemas/common';
import { micronutrientsSchema } from '@/schemas/food';

export const diaryDaySchema = z.object({
  date: dayKeySchema,
  mood: z.number().int().min(1).max(5).nullable(),
  note: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const diaryEntrySchema = z
  .object({
    id: z.string().min(1),
    dayDate: dayKeySchema,
    section: z.string().min(1),
    foodId: z.string().nullable(),
    foodName: z.string().nullable(),
    foodNameEl: z.string().nullable(),
    customLabel: z.string().nullable(),
    quantity: z.number().positive(),
    unit: z.enum(['g', 'ml', 'serving', 'piece', 'tsp', 'tbsp']),
    gramsResolved: nullableNonNegativeNumberSchema,
    energyKcal: nullableNonNegativeNumberSchema,
    proteinG: nullableNonNegativeNumberSchema,
    carbsG: nullableNonNegativeNumberSchema,
    fatG: nullableNonNegativeNumberSchema,
    satFatG: nullableNonNegativeNumberSchema,
    fiberG: nullableNonNegativeNumberSchema,
    sugarG: nullableNonNegativeNumberSchema,
    sodiumMg: nullableNonNegativeNumberSchema,
    microsSnapshot: nullableJsonTextSchema(micronutrientsSchema),
    loggedVia: z.enum([
      'search',
      'barcode',
      'recent',
      'favorite',
      'template',
      'manual',
      'photo',
      'plan',
    ]),
    deletedAt: isoTimestampSchema.nullable(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .refine((entry) => entry.foodId !== null || Boolean(entry.customLabel?.trim()), {
    message: 'An entry requires a food or custom label.',
  });

export const mealSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  nameEl: z.string().nullable(),
  position: z.number().int().nonnegative(),
  isHidden: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  isDefault: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const exerciseLogSchema = z.object({
  id: z.string().min(1),
  dayDate: dayKeySchema,
  activityType: z.string().trim().min(1),
  durationMinutes: z.number().int().nonnegative(),
  energyKcal: z.number().nonnegative(),
  origin: z.enum(['manual', 'healthkit', 'health_connect']),
  externalUid: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const stepsLogSchema = z.object({
  id: z.string().min(1),
  dayDate: dayKeySchema,
  steps: z.number().int().nonnegative(),
  origin: z.enum(['manual', 'healthkit', 'health_connect']),
  externalUid: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
