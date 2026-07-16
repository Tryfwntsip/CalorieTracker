import { z } from 'zod';

import { isoTimestampSchema } from '@/schemas/common';

export const fastingKindSchema = z.enum([
  '12_12',
  '14_10',
  '16_8',
  '18_6',
  '20_4',
  '5_2',
  'adf',
  'custom',
]);

export const fastingPlanSchema = z.object({
  id: z.string().min(1),
  kind: fastingKindSchema,
  name: z.string().trim().min(1),
  fastingMinutes: z.number().int().positive().max(4320),
  eatingMinutes: z.number().int().nonnegative().max(10080),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  fastingWeekdays: z
    .string()
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'Expected valid weekday JSON.' });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.number().int().min(0).max(6))),
  reducedTargetPercent: z.number().int().min(50).max(100),
  notificationsEnabled: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  isActive: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const fastingSessionSchema = z.object({
  id: z.string().min(1),
  planId: z.string().nullable(),
  startedAt: isoTimestampSchema,
  targetEndAt: isoTimestampSchema,
  endedAt: isoTimestampSchema.nullable(),
  status: z.enum(['active', 'completed', 'cancelled']),
  note: z.string().nullable(),
  startNotificationId: z.string().nullable(),
  endNotificationId: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const moodTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEl: z.string().min(1),
  position: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const moodAggregateSchema = z.object({
  dayDate: z.string(),
  mood: z.number().int().min(1).max(5),
});

export const moodTagAggregateSchema = z.object({
  tagId: z.string(),
  name: z.string(),
  nameEl: z.string(),
  count: z.number().int().nonnegative(),
});

export type MoodTagAggregate = z.output<typeof moodTagAggregateSchema>;
