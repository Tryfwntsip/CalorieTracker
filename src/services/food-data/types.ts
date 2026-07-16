import type { FoodWrite, ScannedProductWrite } from '@/types';

export type FoodSearchLocale = 'en' | 'el';

export type ExternalBarcodeProduct = {
  food: FoodWrite;
  rawPayload: ScannedProductWrite['rawPayload'];
};

export interface FoodDataProvider {
  searchText(query: string, locale: FoodSearchLocale, signal?: AbortSignal): Promise<FoodWrite[]>;
  getByBarcode(
    barcode: string,
    locale: FoodSearchLocale,
    signal?: AbortSignal,
  ): Promise<ExternalBarcodeProduct | null>;
}

export type FoodDataErrorCode = 'offline' | 'rate_limited' | 'server' | 'invalid_response';

export class FoodDataError extends Error {
  readonly code: FoodDataErrorCode;

  constructor(code: FoodDataErrorCode, options?: { cause?: unknown }) {
    super('The optional food data service is unavailable.');
    this.name = 'FoodDataError';
    this.code = code;
    this.cause = options?.cause;
  }
}
