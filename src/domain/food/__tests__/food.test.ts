import { foodSnapshotForGrams, normalizeFoodSearch, scaleNutrient } from '@/domain/food';
import type { Food } from '@/types';

const food: Food = {
  id: 'food',
  name: 'Giant beans',
  nameEl: 'Γίγαντες',
  brand: null,
  barcode: null,
  source: 'greek_seed',
  externalId: 'giants',
  sourceUpdatedAt: null,
  quality: 'complete',
  novaClass: 1,
  isLiquid: false,
  servingName: 'plate',
  servingGrams: 250,
  energyKcal: 120,
  proteinG: 8,
  carbsG: 20,
  fatG: 1,
  satFatG: 0.2,
  monoFatG: null,
  polyFatG: null,
  fiberG: 6,
  sugarG: 2,
  saltG: 0.5,
  sodiumMg: 200,
  cholesterolMg: null,
  micros: { iron_mg: 2 },
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

describe('food search and nutrient scaling', () => {
  it.each([
    ['Γίγαντες πλακί', 'γιγαντεσ πλακι'],
    ['ΦΑΚΈΣ', 'φακεσ'],
    ['Greek-yogurt 2%', 'greek yogurt 2'],
  ])('normalizes %s for accent-insensitive search', (input, expected) => {
    expect(normalizeFoodSearch(input)).toBe(expected);
  });

  it('keeps missing nutrients unknown and scales known values', () => {
    expect(scaleNutrient(null, 250)).toBeNull();
    expect(scaleNutrient(12, 250)).toBe(30);
    expect(foodSnapshotForGrams(food, 250)).toMatchObject({
      energyKcal: 300,
      proteinG: 20,
      microsSnapshot: { iron_mg: 5 },
    });
  });
});
