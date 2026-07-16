import { normalizeFoodSearch } from '@/domain/food';
import type { GroceryItemWrite, Recipe, RecipeIngredient } from '@/types';

export type RecipeNutrition = {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};
export type DietaryTag = Recipe['dietaryTags'][number];
export type AllergenTag = Recipe['allergenTags'][number];

function nutrientTotal(
  ingredients: readonly RecipeIngredient[],
  key: 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG',
): number | null {
  if (
    ingredients.length === 0 ||
    ingredients.some((ingredient) => ingredient[key] === null || ingredient.gramsResolved === null)
  ) {
    return null;
  }
  return ingredients.reduce(
    (sum, ingredient) => sum + ((ingredient[key] ?? 0) * (ingredient.gramsResolved ?? 0)) / 100,
    0,
  );
}

export function nutritionPerServing(
  ingredients: readonly RecipeIngredient[],
  servings: number,
): RecipeNutrition {
  const divide = (value: number | null) => (value === null ? null : value / servings);
  return {
    energyKcal: divide(nutrientTotal(ingredients, 'energyKcal')),
    proteinG: divide(nutrientTotal(ingredients, 'proteinG')),
    carbsG: divide(nutrientTotal(ingredients, 'carbsG')),
    fatG: divide(nutrientTotal(ingredients, 'fatG')),
  };
}

export function matchesRecipeFilters(
  recipe: Recipe,
  dietary: DietaryTag | null,
  excludedAllergens: readonly AllergenTag[],
): boolean {
  const compatibleTags: readonly DietaryTag[] =
    dietary === 'vegetarian'
      ? ['vegetarian', 'vegan']
      : dietary === 'pescatarian'
        ? ['pescatarian', 'vegetarian', 'vegan']
        : dietary === null
          ? []
          : [dietary];
  const dietaryMatch =
    dietary === null || compatibleTags.some((tag) => recipe.dietaryTags.includes(tag));
  const allergyMatch = excludedAllergens.every((tag) => !recipe.allergenTags.includes(tag));
  return dietaryMatch && allergyMatch;
}

type Combinable = Pick<
  GroceryItemWrite,
  | 'id'
  | 'listId'
  | 'foodId'
  | 'label'
  | 'quantity'
  | 'unit'
  | 'gramsResolved'
  | 'isChecked'
  | 'position'
>;

export function combineGroceryItems(items: readonly Combinable[]): Combinable[] {
  const combined: Combinable[] = [];
  for (const item of items) {
    const key = item.foodId ?? `label:${normalizeFoodSearch(item.label)}`;
    const matchIndex = combined.findIndex((candidate) => {
      const candidateKey = candidate.foodId ?? `label:${normalizeFoodSearch(candidate.label)}`;
      return candidateKey === key;
    });
    if (matchIndex < 0) {
      combined.push({ ...item, position: combined.length });
      continue;
    }
    const match = combined[matchIndex];
    if (!match) continue;
    if (match.unit === item.unit) {
      combined[matchIndex] = {
        ...match,
        quantity: match.quantity + item.quantity,
        gramsResolved:
          match.gramsResolved !== null && item.gramsResolved !== null
            ? match.gramsResolved + item.gramsResolved
            : null,
        isChecked: match.isChecked && item.isChecked,
      };
    } else if (match.gramsResolved !== null && item.gramsResolved !== null) {
      const grams = match.gramsResolved + item.gramsResolved;
      combined[matchIndex] = {
        ...match,
        quantity: grams,
        unit: 'g',
        gramsResolved: grams,
        isChecked: match.isChecked && item.isChecked,
      };
    } else {
      combined.push({ ...item, position: combined.length });
    }
  }
  return combined;
}
