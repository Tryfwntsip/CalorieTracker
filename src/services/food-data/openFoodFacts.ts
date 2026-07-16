import { z } from 'zod';

import { createId } from '@/lib/id';
import type { FoodWrite } from '@/types';
import {
  type ExternalBarcodeProduct,
  FoodDataError,
  type FoodDataProvider,
  type FoodSearchLocale,
} from '@/services/food-data/types';

const offTextSchema = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim());

const offProductSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(32)),
  product_name: offTextSchema(200).optional(),
  product_name_en: offTextSchema(200).optional(),
  product_name_el: offTextSchema(200).optional(),
  brands: offTextSchema(200).optional(),
  serving_quantity: z.union([z.number(), z.string()]).optional(),
  serving_size: offTextSchema(100).optional(),
  nova_group: z.union([z.number(), z.string()]).optional(),
  nutriments: z.record(z.string(), z.unknown()).default({}),
});

const offSearchResponseSchema = z.object({
  products: z.array(offProductSchema).default([]),
});

const offBarcodeResponseSchema = z.object({
  status: z.string().optional(),
  product: offProductSchema,
});

type OffProduct = z.output<typeof offProductSchema>;

type Fetch = typeof fetch;
const userAgent = 'CalorieTracker/1.0 (https://github.com/Tryfwntsip/CalorieTracker)';

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function nutriment(product: OffProduct, key: string): number | null {
  return optionalNumber(product.nutriments[key]);
}

export function mapOpenFoodFactsProduct(
  product: OffProduct,
  locale: FoodSearchLocale,
  now: string,
  id: string,
): FoodWrite | null {
  const name =
    (locale === 'el' ? product.product_name_el : product.product_name_en) ??
    product.product_name ??
    product.product_name_en ??
    product.product_name_el;
  if (!name?.trim() || !product.code.trim()) return null;

  const energyKcal =
    nutriment(product, 'energy-kcal_100g') ??
    (() => {
      const energyKj = nutriment(product, 'energy-kj_100g');
      return energyKj === null ? null : energyKj / 4.184;
    })();
  const proteinG = nutriment(product, 'proteins_100g');
  const carbsG = nutriment(product, 'carbohydrates_100g');
  const fatG = nutriment(product, 'fat_100g');
  const servingGrams = optionalNumber(product.serving_quantity);
  const novaClass = optionalNumber(product.nova_group);

  return {
    id,
    name: product.product_name_en ?? product.product_name ?? name,
    nameEl: product.product_name_el ?? null,
    brand: product.brands?.trim() || null,
    barcode: product.code,
    source: 'off',
    externalId: product.code,
    sourceUpdatedAt: now,
    quality:
      energyKcal !== null && proteinG !== null && carbsG !== null && fatG !== null
        ? 'complete'
        : 'partial',
    novaClass:
      novaClass !== null && Number.isInteger(novaClass) && novaClass >= 1 && novaClass <= 4
        ? novaClass
        : null,
    isLiquid: false,
    servingName: product.serving_size?.trim() || null,
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : null,
    energyKcal,
    proteinG,
    carbsG,
    fatG,
    satFatG: nutriment(product, 'saturated-fat_100g'),
    monoFatG: nutriment(product, 'monounsaturated-fat_100g'),
    polyFatG: nutriment(product, 'polyunsaturated-fat_100g'),
    fiberG: nutriment(product, 'fiber_100g'),
    sugarG: nutriment(product, 'sugars_100g'),
    saltG: nutriment(product, 'salt_100g'),
    sodiumMg: (() => {
      const sodiumG = nutriment(product, 'sodium_100g');
      return sodiumG === null ? null : sodiumG * 1000;
    })(),
    cholesterolMg: (() => {
      const cholesterolG = nutriment(product, 'cholesterol_100g');
      return cholesterolG === null ? null : cholesterolG * 1000;
    })(),
    micros: null,
  };
}

export function createOpenFoodFactsProvider(options?: {
  fetch?: Fetch;
  now?: () => string;
  id?: () => string;
}): FoodDataProvider {
  const fetcher = options?.fetch ?? fetch;
  const now = options?.now ?? (() => new Date().toISOString());
  const id = options?.id ?? (() => createId());

  return {
    async searchText(query, locale, signal) {
      const parsedQuery = z.string().trim().min(2).max(100).safeParse(query);
      if (!parsedQuery.success) throw new FoodDataError('invalid_response');
      const params = new URLSearchParams({
        search_terms: parsedQuery.data,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '20',
        lc: locale,
        fields:
          'code,product_name,product_name_en,product_name_el,brands,serving_quantity,serving_size,nova_group,nutriments',
      });

      let response: Response;
      try {
        response = await fetcher(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': userAgent,
          },
          signal,
        });
      } catch (error: unknown) {
        throw new FoodDataError('offline', { cause: error });
      }

      if (response.status === 429) throw new FoodDataError('rate_limited');
      if (!response.ok) throw new FoodDataError('server');

      try {
        const payload = offSearchResponseSchema.parse(await response.json());
        return payload.products
          .map((product) => mapOpenFoodFactsProduct(product, locale, now(), id()))
          .filter((food): food is FoodWrite => food !== null);
      } catch (error: unknown) {
        throw new FoodDataError('invalid_response', { cause: error });
      }
    },
    async getByBarcode(barcode, locale, signal): Promise<ExternalBarcodeProduct | null> {
      const parsedBarcode = z
        .string()
        .regex(/^\d{13}$/)
        .safeParse(barcode);
      if (!parsedBarcode.success) throw new FoodDataError('invalid_response');
      const params = new URLSearchParams({
        lc: locale,
        fields:
          'code,product_name,product_name_en,product_name_el,brands,serving_quantity,serving_size,nova_group,nutriments',
      });

      let response: Response;
      try {
        response = await fetcher(
          `https://world.openfoodfacts.org/api/v3/product/${parsedBarcode.data}?${params}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': userAgent,
            },
            signal,
          },
        );
      } catch (error: unknown) {
        throw new FoodDataError('offline', { cause: error });
      }

      if (response.status === 404) return null;
      if (response.status === 429) throw new FoodDataError('rate_limited');
      if (!response.ok) throw new FoodDataError('server');

      try {
        const rawPayload = z.json().parse(await response.json());
        const payload = offBarcodeResponseSchema.parse(rawPayload);
        const food = mapOpenFoodFactsProduct(payload.product, locale, now(), id());
        if (!food) throw new FoodDataError('invalid_response');
        const serializedPayload = JSON.stringify(payload);
        const decodedPayload: unknown = JSON.parse(serializedPayload);
        return {
          food: { ...food, barcode: parsedBarcode.data, externalId: parsedBarcode.data },
          rawPayload: z.json().parse(decodedPayload),
        };
      } catch (error: unknown) {
        if (error instanceof FoodDataError) throw error;
        throw new FoodDataError('invalid_response', { cause: error });
      }
    },
  };
}
