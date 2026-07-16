import { initializeDatabase } from '@/db/initialize';
import { createFoodRepository } from '@/repositories';
import { searchAndCacheExternalFoods } from '@/services/food-data/search';
import type { FoodDataProvider } from '@/services/food-data/types';
import { createTestDatabase } from '@/test/sqlite';

describe('external food cache-through', () => {
  it('persists optional online results so they are searchable offline afterwards', async () => {
    const database = createTestDatabase();
    await initializeDatabase(database);
    const provider: FoodDataProvider = {
      searchText: async () => [
        {
          id: 'off-cereal',
          name: 'Cached cereal',
          nameEl: null,
          brand: 'Example',
          barcode: '5201234567890',
          source: 'off',
          externalId: '5201234567890',
          sourceUpdatedAt: '2026-07-16T08:00:00.000Z',
          quality: 'complete',
          novaClass: 3,
          isLiquid: false,
          servingName: '40 g',
          servingGrams: 40,
          energyKcal: 400,
          proteinG: 10,
          carbsG: 70,
          fatG: 8,
          satFatG: 2,
          monoFatG: null,
          polyFatG: null,
          fiberG: 7,
          sugarG: 15,
          saltG: 0.8,
          sodiumMg: 320,
          cholesterolMg: null,
          micros: null,
        },
      ],
      getByBarcode: async () => null,
    };

    await expect(
      searchAndCacheExternalFoods(database, 'cereal', 'en', provider),
    ).resolves.toMatchObject([{ id: 'off-cereal', source: 'off' }]);
    await expect(createFoodRepository(database).search('cached cereal')).resolves.toMatchObject([
      { id: 'off-cereal' },
    ]);
    database.close();
  });
});
