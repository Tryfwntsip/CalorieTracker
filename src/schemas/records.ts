import { z } from 'zod';

import { dayKeySchema, isoTimestampSchema, nullableJsonTextSchema } from '@/schemas/common';

export const weightRecordSchema = z.object({
  id: z.string().min(1),
  dayDate: dayKeySchema,
  weightKg: z.number().positive(),
  origin: z.enum(['manual', 'healthkit', 'health_connect']),
  externalUid: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const waterRecordSchema = z.object({
  id: z.string().min(1),
  dayDate: dayKeySchema,
  amountMl: z.number().int().positive(),
  loggedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
});

export const scannedProductSchema = z.object({
  barcode: z.string().min(1),
  foodId: z.string().nullable(),
  source: z.literal('off'),
  rawPayload: nullableJsonTextSchema(z.json()),
  fetchedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const barcodeScanHistorySchema = z.object({
  id: z.string().min(1),
  barcode: z.string().min(1),
  status: z.enum(['found_local', 'found_online', 'not_found', 'offline']),
  resolvedFoodId: z.string().nullable(),
  scannedAt: isoTimestampSchema,
});
