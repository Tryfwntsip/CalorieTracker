import type { Food } from '@/types';

export function normalizeFoodSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el')
    .replace(/ς/g, 'σ')
    .replace(/[^a-z0-9α-ω]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function scaleNutrient(value: number | null, grams: number): number | null {
  return value === null ? null : (value * grams) / 100;
}

export type FoodSnapshot = {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  microsSnapshot: Food['micros'];
};

export function foodSnapshotForGrams(food: Food, grams: number): FoodSnapshot {
  const microsSnapshot =
    food.micros === null
      ? null
      : Object.fromEntries(
          Object.entries(food.micros).map(([key, value]) => [key, (value * grams) / 100]),
        );

  return {
    energyKcal: scaleNutrient(food.energyKcal, grams),
    proteinG: scaleNutrient(food.proteinG, grams),
    carbsG: scaleNutrient(food.carbsG, grams),
    fatG: scaleNutrient(food.fatG, grams),
    satFatG: scaleNutrient(food.satFatG, grams),
    fiberG: scaleNutrient(food.fiberG, grams),
    sugarG: scaleNutrient(food.sugarG, grams),
    sodiumMg: scaleNutrient(food.sodiumMg, grams),
    microsSnapshot,
  };
}
