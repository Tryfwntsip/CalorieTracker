import { z } from 'zod';

export const barcodeInputSchema = z.object({
  barcode: z.string().trim().min(1).max(32),
});
