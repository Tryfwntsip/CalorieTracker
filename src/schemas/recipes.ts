import { z } from 'zod';

import { isoTimestampSchema, nullableJsonTextSchema } from '@/schemas/common';

export const recipeTagSchema = z.enum([
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten_free',
  'mediterranean',
  'high_protein',
]);
export const allergenTagSchema = z.enum([
  'dairy',
  'egg',
  'fish',
  'shellfish',
  'nuts',
  'sesame',
  'gluten',
]);
export const recipeUnitSchema = z.enum(['g', 'ml', 'piece']);

const stringArrayJson = nullableJsonTextSchema(z.array(z.string().trim().min(1)));
const tagArrayJson = nullableJsonTextSchema(z.array(recipeTagSchema));
const allergenArrayJson = nullableJsonTextSchema(z.array(allergenTagSchema));

export const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  titleEl: z.string().nullable(),
  servings: z.number().positive(),
  prepMinutes: z.number().int().nonnegative(),
  cookMinutes: z.number().int().nonnegative(),
  instructions: stringArrayJson.transform((value) => value ?? []),
  instructionsEl: stringArrayJson,
  dietaryTags: tagArrayJson.transform((value) => value ?? []),
  allergenTags: allergenArrayJson.transform((value) => value ?? []),
  source: z.enum(['user', 'seed']),
  isFavorite: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const recipeIngredientSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1),
  foodId: z.string().nullable(),
  label: z.string().trim().min(1),
  labelEl: z.string().nullable(),
  quantity: z.number().positive(),
  unit: recipeUnitSchema,
  gramsResolved: z.number().positive().nullable(),
  position: z.number().int().nonnegative(),
  energyKcal: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  createdAt: isoTimestampSchema,
});

export const groceryListSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const groceryItemSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  foodId: z.string().nullable(),
  label: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit: recipeUnitSchema,
  gramsResolved: z.number().positive().nullable(),
  isChecked: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  position: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const recipeDraftFormSchema = z.object({
  title: z.string().trim().min(1),
  servings: z.number().positive(),
  ingredients: z
    .array(z.object({ foodId: z.string().min(1), grams: z.number().positive() }))
    .min(1),
});

export const groceryListFormSchema = z.object({
  name: z.string().trim().min(1),
});

export const groceryItemFormSchema = z.object({
  label: z.string().trim().min(1),
  quantity: z.number().positive(),
});
