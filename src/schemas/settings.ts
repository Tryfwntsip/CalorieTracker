import { z } from 'zod';

import { isoTimestampSchema, nullableJsonTextSchema } from '@/schemas/common';

const sectionOrderSchema = z.array(z.string().min(1));
const weekdayOverridesSchema = z.record(z.string().regex(/^[0-6]$/), z.number().int().positive());

export const settingsSchema = z.object({
  id: z.literal(1),
  language: z.enum(['en', 'el']),
  theme: z.enum(['system', 'light', 'dark']),
  unitSystem: z.literal('metric'),
  waterGoalMl: z.number().int().positive(),
  weekStartsOn: z.number().int().min(0).max(6),
  diarySectionOrder: nullableJsonTextSchema(sectionOrderSchema),
  weekdayCalorieOverrides: nullableJsonTextSchema(weekdayOverridesSchema),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
