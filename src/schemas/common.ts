import { z } from 'zod';

import { isDayKey } from '@/domain/dates';

export const isoTimestampSchema = z.iso.datetime({ offset: true });
export const dayKeySchema = z.string().refine(isDayKey, 'Expected a valid YYYY-MM-DD date.');
export const nullableNonNegativeNumberSchema = z.number().nonnegative().nullable();

export function nullableJsonTextSchema<T>(schema: z.ZodType<T>) {
  return z
    .string()
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'Expected valid JSON.' });
        return z.NEVER;
      }
    })
    .pipe(schema)
    .nullable();
}
