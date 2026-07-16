import type { z } from 'zod';

import {
  barcodeScanHistorySchema,
  diaryDaySchema,
  diaryEntrySchema,
  exerciseLogSchema,
  foodPortionSchema,
  foodFavoriteSchema,
  foodOverrideSchema,
  foodRecentSchema,
  foodSchema,
  mealSectionSchema,
  mealTemplateItemSchema,
  mealTemplateSchema,
  mealPlanSchema,
  mealPlanEntrySchema,
  profileGoalHistorySchema,
  profileSchema,
  scannedProductSchema,
  recipeSchema,
  recipeIngredientSchema,
  groceryListSchema,
  groceryItemSchema,
  settingsSchema,
  stepsLogSchema,
  weightRecordSchema,
  waterRecordSchema,
} from '@/schemas';

export type Profile = z.output<typeof profileSchema>;
export type ProfileGoalHistory = z.output<typeof profileGoalHistorySchema>;
export type Settings = z.output<typeof settingsSchema>;
export type Food = z.output<typeof foodSchema>;
export type FoodPortion = z.output<typeof foodPortionSchema>;
export type FoodOverride = z.output<typeof foodOverrideSchema>;
export type FoodFavorite = z.output<typeof foodFavoriteSchema>;
export type FoodRecent = z.output<typeof foodRecentSchema>;
export type MealTemplate = z.output<typeof mealTemplateSchema>;
export type MealTemplateItem = z.output<typeof mealTemplateItemSchema>;
export type MealPlan = z.output<typeof mealPlanSchema>;
export type MealPlanEntry = z.output<typeof mealPlanEntrySchema>;
export type DiaryDay = z.output<typeof diaryDaySchema>;
export type DiaryEntry = z.output<typeof diaryEntrySchema>;
export type MealSection = z.output<typeof mealSectionSchema>;
export type ExerciseLog = z.output<typeof exerciseLogSchema>;
export type StepsLog = z.output<typeof stepsLogSchema>;
export type WeightRecord = z.output<typeof weightRecordSchema>;
export type WaterRecord = z.output<typeof waterRecordSchema>;
export type ScannedProduct = z.output<typeof scannedProductSchema>;
export type BarcodeScanHistory = z.output<typeof barcodeScanHistorySchema>;
export type Recipe = z.output<typeof recipeSchema>;
export type RecipeIngredient = z.output<typeof recipeIngredientSchema>;
export type GroceryList = z.output<typeof groceryListSchema>;
export type GroceryItem = z.output<typeof groceryItemSchema>;

export type ProfileWrite = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;
export type SettingsWrite = Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>;
export type FoodWrite = Omit<Food, 'createdAt' | 'updatedAt'>;
export type FoodPortionWrite = FoodPortion;
export type FoodOverrideWrite = Omit<FoodOverride, 'updatedAt'>;
export type MealTemplateWrite = Omit<MealTemplate, 'createdAt' | 'updatedAt'>;
export type MealTemplateItemWrite = Omit<MealTemplateItem, 'createdAt'>;
export type MealPlanWrite = Omit<MealPlan, 'createdAt' | 'updatedAt'>;
export type MealPlanEntryWrite = Omit<
  MealPlanEntry,
  'label' | 'labelEl' | 'createdAt' | 'updatedAt'
>;
export type DiaryDayWrite = Omit<DiaryDay, 'createdAt' | 'updatedAt'>;
export type DiaryEntryWrite = Omit<
  DiaryEntry,
  'foodName' | 'foodNameEl' | 'createdAt' | 'updatedAt'
>;
export type MealSectionWrite = Omit<MealSection, 'createdAt' | 'updatedAt'>;
export type ExerciseLogWrite = Omit<ExerciseLog, 'createdAt' | 'updatedAt'>;
export type StepsLogWrite = Omit<StepsLog, 'createdAt' | 'updatedAt'>;
export type WeightRecordWrite = Omit<WeightRecord, 'createdAt' | 'updatedAt'>;
export type WaterRecordWrite = Omit<WaterRecord, 'createdAt'>;
export type ScannedProductWrite = Omit<ScannedProduct, 'createdAt' | 'updatedAt'>;
export type BarcodeScanHistoryWrite = BarcodeScanHistory;
export type RecipeWrite = Omit<Recipe, 'isFavorite' | 'createdAt' | 'updatedAt'>;
export type RecipeIngredientWrite = Omit<
  RecipeIngredient,
  'labelEl' | 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG' | 'createdAt'
>;
export type GroceryListWrite = Omit<GroceryList, 'createdAt' | 'updatedAt'>;
export type GroceryItemWrite = Omit<GroceryItem, 'createdAt' | 'updatedAt'>;
