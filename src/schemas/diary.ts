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
    section: z.enum(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra']),
    foodId: z.string().nullable(),
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
