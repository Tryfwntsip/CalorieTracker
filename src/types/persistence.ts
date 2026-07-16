import type { z } from 'zod';

import {
  barcodeScanHistorySchema,
  diaryDaySchema,
  diaryEntrySchema,
  foodPortionSchema,
  foodSchema,
  profileGoalHistorySchema,
  profileSchema,
  scannedProductSchema,
  settingsSchema,
  weightRecordSchema,
  waterRecordSchema,
} from '@/schemas';

export type Profile = z.output<typeof profileSchema>;
export type ProfileGoalHistory = z.output<typeof profileGoalHistorySchema>;
export type Settings = z.output<typeof settingsSchema>;
export type Food = z.output<typeof foodSchema>;
export type FoodPortion = z.output<typeof foodPortionSchema>;
export type DiaryDay = z.output<typeof diaryDaySchema>;
export type DiaryEntry = z.output<typeof diaryEntrySchema>;
export type WeightRecord = z.output<typeof weightRecordSchema>;
export type WaterRecord = z.output<typeof waterRecordSchema>;
export type ScannedProduct = z.output<typeof scannedProductSchema>;
export type BarcodeScanHistory = z.output<typeof barcodeScanHistorySchema>;

export type ProfileWrite = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;
export type SettingsWrite = Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>;
export type FoodWrite = Omit<Food, 'createdAt' | 'updatedAt'>;
export type FoodPortionWrite = FoodPortion;
export type DiaryDayWrite = Omit<DiaryDay, 'createdAt' | 'updatedAt'>;
export type DiaryEntryWrite = Omit<DiaryEntry, 'createdAt' | 'updatedAt'>;
export type WeightRecordWrite = Omit<WeightRecord, 'createdAt' | 'updatedAt'>;
export type WaterRecordWrite = Omit<WaterRecord, 'createdAt'>;
export type ScannedProductWrite = Omit<ScannedProduct, 'createdAt' | 'updatedAt'>;
export type BarcodeScanHistoryWrite = BarcodeScanHistory;
