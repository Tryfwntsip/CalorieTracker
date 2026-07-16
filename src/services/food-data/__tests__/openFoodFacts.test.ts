import {
  createOpenFoodFactsProvider,
  mapOpenFoodFactsProduct,
} from '@/services/food-data/openFoodFacts';
import { FoodDataError } from '@/services/food-data/types';

const product = {
  code: '5201234567890',
  product_name: 'Test cereal',
  product_name_el: 'Δημητριακά δοκιμής',
  brands: 'Example',
  serving_quantity: '40',
  serving_size: '40 g',
  nova_group: 3,
  nutriments: {
    'energy-kj_100g': 1673.6,
    proteins_100g: 10,
    carbohydrates_100g: 70,
    fat_100g: 8,
    'saturated-fat_100g': 2,
    fiber_100g: 7,
    sugars_100g: 15,
    salt_100g: 0.8,
    sodium_100g: 0.32,
  },
};

describe('Open Food Facts adapter', () => {
  it('maps canonical nutrients, converts kJ and sodium, and preserves missing values', () => {
    const mapped = mapOpenFoodFactsProduct(product, 'el', '2026-07-16T08:00:00.000Z', 'off-food');
    expect(mapped).toMatchObject({
      id: 'off-food',
      name: 'Test cereal',
      nameEl: 'Δημητριακά δοκιμής',
      sodiumMg: 320,
      cholesterolMg: null,
      quality: 'complete',
      source: 'off',
    });
    expect(mapped?.energyKcal).toBeCloseTo(400);
  });

  it('uses an explicit request, validates the response, and sends a custom user agent', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ products: [product] }),
    })) as unknown as typeof fetch;
    const provider = createOpenFoodFactsProvider({
      fetch: fetcher,
      now: () => '2026-07-16T08:00:00.000Z',
      id: () => 'off-food',
    });

    await expect(provider.searchText('cereal', 'en')).resolves.toMatchObject([
      { id: 'off-food', externalId: '5201234567890' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('search_terms=cereal'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('CalorieTracker'),
        }),
      }),
    );
  });

  it('maps a network failure to the optional offline state', async () => {
    const fetcher = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const provider = createOpenFoodFactsProvider({ fetch: fetcher });

    await expect(provider.searchText('cereal', 'en')).rejects.toMatchObject({
      code: 'offline',
    } satisfies Partial<FoodDataError>);
  });

  it('rejects malformed provider payloads at the boundary', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ products: [{ code: null }] }),
    })) as unknown as typeof fetch;
    const provider = createOpenFoodFactsProvider({ fetch: fetcher });

    await expect(provider.searchText('cereal', 'en')).rejects.toMatchObject({
      code: 'invalid_response',
    } satisfies Partial<FoodDataError>);
  });
});
