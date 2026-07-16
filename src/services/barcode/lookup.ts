import type { Database } from '@/db/types';
import { createId } from '@/lib/id';
import { createBarcodeRepository, createFoodRepository } from '@/repositories';
import { createOpenFoodFactsProvider } from '@/services/food-data/openFoodFacts';
import {
  FoodDataError,
  type FoodDataErrorCode,
  type FoodDataProvider,
  type FoodSearchLocale,
} from '@/services/food-data/types';
import type { Food } from '@/types';

export type BarcodeLookupStatus = 'found_local' | 'found_online' | 'not_found' | 'offline';

export type BarcodeLookupResult = {
  barcode: string;
  status: BarcodeLookupStatus;
  food: Food | null;
  errorCode: FoodDataErrorCode | null;
};

type LookupOptions = {
  provider?: FoodDataProvider;
  now?: () => string;
  id?: () => string;
  timeoutMs?: number;
};

export async function lookupBarcode(
  database: Database,
  barcode: string,
  locale: FoodSearchLocale,
  options: LookupOptions = {},
): Promise<BarcodeLookupResult> {
  const provider = options.provider ?? createOpenFoodFactsProvider();
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => createId());
  const timeoutMs = options.timeoutMs ?? 8_000;
  const foods = createFoodRepository(database);
  const barcodes = createBarcodeRepository(database);

  const record = async (
    status: BarcodeLookupStatus,
    food: Food | null,
    errorCode: FoodDataErrorCode | null = null,
  ): Promise<BarcodeLookupResult> => {
    await barcodes.createHistory({
      id: id(),
      barcode,
      status,
      resolvedFoodId: food?.id ?? null,
      scannedAt: now(),
    });
    return { barcode, status, food, errorCode };
  };

  const directFood = await foods.getByBarcode(barcode);
  if (directFood) return record('found_local', directFood);

  const cachedProduct = await barcodes.getProduct(barcode);
  if (cachedProduct?.foodId) {
    const cachedFood = await foods.get(cachedProduct.foodId);
    if (cachedFood) return record('found_local', cachedFood);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const external = await provider.getByBarcode(barcode, locale, controller.signal);
    if (!external) return record('not_found', null);
    const food = await foods.upsertExternal({
      ...external.food,
      barcode,
      externalId: barcode,
    });
    await barcodes.upsertProduct({
      barcode,
      foodId: food.id,
      source: 'off',
      rawPayload: external.rawPayload,
      fetchedAt: now(),
    });
    return record('found_online', food);
  } catch (error: unknown) {
    if (error instanceof FoodDataError) return record('offline', null, error.code);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
