import { initializeDatabase } from '@/db/initialize';
import { createBarcodeRepository, createFoodRepository } from '@/repositories';
import { lookupBarcode } from '@/services/barcode/lookup';
import { FoodDataError, type FoodDataProvider } from '@/services/food-data/types';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';
import type { FoodWrite } from '@/types';

const timestamp = '2026-07-16T08:00:00.000Z';
const barcode = '3017620422003';

const food: FoodWrite = {
  id: 'barcode-food',
  name: 'Barcode food',
  nameEl: 'Τρόφιμο barcode',
  brand: 'Example',
  barcode,
  source: 'user',
  externalId: null,
  sourceUpdatedAt: null,
  quality: 'user_entered',
  novaClass: null,
  isLiquid: false,
  servingName: 'serving',
  servingGrams: 30,
  energyKcal: 400,
  proteinG: 8,
  carbsG: 70,
  fatG: 10,
  satFatG: null,
  monoFatG: null,
  polyFatG: null,
  fiberG: null,
  sugarG: null,
  saltG: null,
  sodiumMg: null,
  cholesterolMg: null,
  micros: null,
};

function provider(getByBarcode: FoodDataProvider['getByBarcode']): FoodDataProvider {
  return {
    searchText: async () => [],
    getByBarcode,
  };
}

describe('barcode lookup orchestration', () => {
  let database: TestDatabase;
  let nextId: number;
  const options = {
    now: () => timestamp,
    id: () => `scan-${++nextId}`,
  };

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
    nextId = 0;
  });

  afterEach(() => database.close());

  it('resolves a known food locally without invoking the provider', async () => {
    await createFoodRepository(database).create(food);
    const external = jest.fn();

    await expect(
      lookupBarcode(database, barcode, 'en', {
        ...options,
        provider: provider(external),
      }),
    ).resolves.toMatchObject({ status: 'found_local', food: { id: food.id } });
    expect(external).not.toHaveBeenCalled();
    await expect(createBarcodeRepository(database).listHistory()).resolves.toMatchObject([
      { barcode, status: 'found_local', resolvedFoodId: food.id },
    ]);
  });

  it('caches an online result into both food and scanned-product storage', async () => {
    const offFood = {
      ...food,
      id: 'off-food',
      source: 'off' as const,
      externalId: barcode,
      sourceUpdatedAt: timestamp,
      quality: 'complete' as const,
    };
    const onlineProvider = provider(async () => ({
      food: offFood,
      rawPayload: { status: 'success', product: { code: barcode } },
    }));

    await expect(
      lookupBarcode(database, barcode, 'en', { ...options, provider: onlineProvider }),
    ).resolves.toMatchObject({ status: 'found_online', food: { id: offFood.id } });
    await expect(createBarcodeRepository(database).getProduct(barcode)).resolves.toMatchObject({
      barcode,
      foodId: offFood.id,
    });

    const unavailableProvider = provider(async () => {
      throw new FoodDataError('offline');
    });
    await expect(
      lookupBarcode(database, barcode, 'en', {
        ...options,
        provider: unavailableProvider,
      }),
    ).resolves.toMatchObject({ status: 'found_local', food: { id: offFood.id } });
  });

  it('records not-found and offline scans as graceful outcomes', async () => {
    await expect(
      lookupBarcode(database, barcode, 'en', {
        ...options,
        provider: provider(async () => null),
      }),
    ).resolves.toMatchObject({ status: 'not_found', food: null });
    await expect(
      lookupBarcode(database, barcode, 'en', {
        ...options,
        provider: provider(async () => {
          throw new FoodDataError('offline');
        }),
      }),
    ).resolves.toMatchObject({ status: 'offline', errorCode: 'offline' });

    await expect(createBarcodeRepository(database).listHistory()).resolves.toMatchObject([
      { status: 'offline' },
      { status: 'not_found' },
    ]);
  });

  it('aborts an online lookup before the ten-second acceptance limit', async () => {
    jest.useFakeTimers();
    try {
      const waitingProvider = provider(
        async (_barcode, _locale, signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new FoodDataError('offline')));
          }),
      );
      const result = lookupBarcode(database, barcode, 'en', {
        ...options,
        provider: waitingProvider,
        timeoutMs: 8_000,
      });

      await jest.advanceTimersByTimeAsync(8_000);
      await expect(result).resolves.toMatchObject({
        status: 'offline',
        errorCode: 'offline',
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
