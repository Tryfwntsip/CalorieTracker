import { combineGroceryItems, matchesRecipeFilters, nutritionPerServing } from '@/domain/recipes';
import type { Recipe, RecipeIngredient } from '@/types';

const timestamp = '2026-07-16T08:00:00.000Z';

function ingredient(id: string, grams: number | null, energyKcal: number | null): RecipeIngredient {
  return {
    id,
    recipeId: 'recipe',
    foodId: id,
    label: id,
    labelEl: null,
    quantity: grams ?? 1,
    unit: grams === null ? 'piece' : 'g',
    gramsResolved: grams,
    position: 0,
    energyKcal,
    proteinG: energyKcal === null ? null : 10,
    carbsG: energyKcal === null ? null : 20,
    fatG: energyKcal === null ? null : 5,
    createdAt: timestamp,
  };
}

describe('recipe calculations', () => {
  it('calculates nutrition per serving from per-100g ingredients', () => {
    const result = nutritionPerServing(
      [ingredient('one', 200, 100), ingredient('two', 100, 200)],
      2,
    );
    expect(result).toEqual({ energyKcal: 200, proteinG: 15, carbsG: 30, fatG: 7.5 });
  });

  it('preserves unknown nutrition instead of silently treating it as zero', () => {
    expect(nutritionPerServing([ingredient('unknown', null, 100)], 2).energyKcal).toBeNull();
    expect(nutritionPerServing([ingredient('unknown', 100, null)], 2).energyKcal).toBeNull();
  });

  it('combines matching units and converts compatible resolved amounts to grams', () => {
    const base = {
      listId: 'list',
      foodId: 'food',
      label: 'Tomato',
      isChecked: false,
      position: 0,
    };
    expect(
      combineGroceryItems([
        { ...base, id: 'one', quantity: 100, unit: 'g', gramsResolved: 100 },
        { ...base, id: 'two', quantity: 2, unit: 'piece', gramsResolved: 240 },
      ]),
    ).toEqual([
      {
        ...base,
        id: 'one',
        quantity: 340,
        unit: 'g',
        gramsResolved: 340,
      },
    ]);
  });

  it('normalizes manual labels and preserves checked state only when all merged rows are checked', () => {
    const result = combineGroceryItems([
      {
        id: 'one',
        listId: 'list',
        foodId: null,
        label: '  Ντομάτα ',
        quantity: 2,
        unit: 'piece',
        gramsResolved: null,
        isChecked: true,
        position: 0,
      },
      {
        id: 'two',
        listId: 'list',
        foodId: null,
        label: 'ντοματα',
        quantity: 1,
        unit: 'piece',
        gramsResolved: null,
        isChecked: false,
        position: 1,
      },
    ]);
    expect(result).toMatchObject([{ quantity: 3, isChecked: false }]);
  });

  it('applies dietary inclusion and allergen exclusion together', () => {
    const recipe = {
      dietaryTags: ['vegetarian'],
      allergenTags: ['dairy'],
    } as Recipe;
    expect(matchesRecipeFilters(recipe, 'vegetarian', [])).toBe(true);
    expect(matchesRecipeFilters(recipe, 'vegan', [])).toBe(false);
    expect(matchesRecipeFilters(recipe, 'vegetarian', ['dairy'])).toBe(false);
  });
});
