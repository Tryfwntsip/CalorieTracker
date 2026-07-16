import type { Database } from '@/db/types';
import { createFoodRepository } from '@/repositories';
import { createOpenFoodFactsProvider } from '@/services/food-data/openFoodFacts';
import type { FoodDataProvider, FoodSearchLocale } from '@/services/food-data/types';
import type { Food } from '@/types';

export async function searchAndCacheExternalFoods(
  database: Database,
  query: string,
  locale: FoodSearchLocale,
  provider: FoodDataProvider = createOpenFoodFactsProvider(),
): Promise<Food[]> {
  const candidates = await provider.searchText(query, locale);
  const foods = createFoodRepository(database);
  const cached: Food[] = [];
  for (const candidate of candidates) {
    cached.push(await foods.upsertExternal(candidate));
  }
  return cached;
}
