import { z } from 'zod';

import {
  isoTimestampSchema,
  nullableJsonTextSchema,
  nullableNonNegativeNumberSchema,
} from '@/schemas/common';

export const micronutrientsSchema = z
  .object({
    vit_a_ug: z.number().nonnegative().optional(),
    vit_c_mg: z.number().nonnegative().optional(),
    vit_d_ug: z.number().nonnegative().optional(),
    vit_e_mg: z.number().nonnegative().optional(),
    vit_k_ug: z.number().nonnegative().optional(),
    thiamin_mg: z.number().nonnegative().optional(),
    riboflavin_mg: z.number().nonnegative().optional(),
    niacin_mg: z.number().nonnegative().optional(),
    vit_b6_mg: z.number().nonnegative().optional(),
    folate_ug: z.number().nonnegative().optional(),
    vit_b12_ug: z.number().nonnegative().optional(),
    calcium_mg: z.number().nonnegative().optional(),
    iron_mg: z.number().nonnegative().optional(),
    magnesium_mg: z.number().nonnegative().optional(),
    potassium_mg: z.number().nonnegative().optional(),
    zinc_mg: z.number().nonnegative().optional(),
    phosphorus_mg: z.number().nonnegative().optional(),
    selenium_ug: z.number().nonnegative().optional(),
    iodine_ug: z.number().nonnegative().optional(),
  })
  .strict();

export const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  nameEl: z.string().nullable(),
  brand: z.string().nullable(),
  barcode: z.string().nullable(),
  source: z.enum(['user', 'greek_seed', 'off']),
  externalId: z.string().nullable(),
  sourceUpdatedAt: isoTimestampSchema.nullable(),
  quality: z.enum(['verified', 'complete', 'partial', 'user_entered']),
  novaClass: z.number().int().min(1).max(4).nullable(),
  isLiquid: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  servingName: z.string().nullable(),
  servingGrams: z.number().positive().nullable(),
  energyKcal: nullableNonNegativeNumberSchema,
  proteinG: nullableNonNegativeNumberSchema,
  carbsG: nullableNonNegativeNumberSchema,
  fatG: nullableNonNegativeNumberSchema,
  satFatG: nullableNonNegativeNumberSchema,
  monoFatG: nullableNonNegativeNumberSchema,
  polyFatG: nullableNonNegativeNumberSchema,
  fiberG: nullableNonNegativeNumberSchema,
  sugarG: nullableNonNegativeNumberSchema,
  saltG: nullableNonNegativeNumberSchema,
  sodiumMg: nullableNonNegativeNumberSchema,
  cholesterolMg: nullableNonNegativeNumberSchema,
  micros: nullableJsonTextSchema(micronutrientsSchema),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const foodPortionSchema = z.object({
  id: z.string().min(1),
  foodId: z.string().min(1),
  label: z.string().trim().min(1),
  labelEl: z.string().nullable(),
  grams: z.number().positive(),
});
