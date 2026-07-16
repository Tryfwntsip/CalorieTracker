import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { addDays } from '@/domain/dates';
import { foodSnapshotForGrams } from '@/domain/food';
import { combineGroceryItems, nutritionPerServing } from '@/domain/recipes';
import { createId } from '@/lib/id';
import {
  createDiaryRepository,
  createFoodRepository,
  createGroceryRepository,
  createMealPlanRepository,
  createMealTemplateRepository,
  createRecipeRepository,
} from '@/repositories';
import type {
  Food,
  GroceryItemWrite,
  MealPlan,
  MealPlanEntry,
  MealTemplate,
  Recipe,
} from '@/types';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      plan: MealPlan;
      entries: MealPlanEntry[];
      recipes: Recipe[];
      templates: MealTemplate[];
      foodResults: Food[];
    };

export function useMealPlanner(weekStart: string) {
  const database = useDatabase();
  const plans = useMemo(() => createMealPlanRepository(database), [database]);
  const recipes = useMemo(() => createRecipeRepository(database), [database]);
  const foods = useMemo(() => createFoodRepository(database), [database]);
  const templates = useMemo(() => createMealTemplateRepository(database), [database]);
  const groceries = useMemo(() => createGroceryRepository(database), [database]);
  const diary = useMemo(() => createDiaryRepository(database), [database]);
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      let plan = await plans.getByWeek(weekStart);
      if (!plan) plan = await plans.create({ id: createId(), weekStart });
      const [entries, recipeRows, templateRows] = await Promise.all([
        plans.listEntries(plan.id),
        recipes.list(),
        templates.list(),
      ]);
      setState({
        status: 'ready',
        plan,
        entries,
        recipes: recipeRows,
        templates: templateRows,
        foodResults: [],
      });
    } catch {
      setState({ status: 'error' });
    }
  }, [plans, recipes, templates, weekStart]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const reloadEntries = useCallback(async () => {
    if (state.status !== 'ready') return;
    const entries = await plans.listEntries(state.plan.id);
    setState((current) => (current.status === 'ready' ? { ...current, entries } : current));
  }, [plans, state]);

  return {
    state,
    retry: load,
    async searchFoods(query: string) {
      const foodResults = await foods.search(query, 8);
      setState((current) => (current.status === 'ready' ? { ...current, foodResults } : current));
    },
    async assign(
      dayDate: string,
      section: string,
      source: { recipeId?: string; foodId?: string; templateId?: string },
    ) {
      if (state.status !== 'ready') return;
      await plans.saveEntry({
        id: createId(),
        planId: state.plan.id,
        dayDate,
        section,
        recipeId: source.recipeId ?? null,
        foodId: source.foodId ?? null,
        templateId: source.templateId ?? null,
        quantity: source.foodId ? 100 : 1,
        position: 0,
      });
      await reloadEntries();
    },
    async remove(entry: MealPlanEntry) {
      await plans.deleteEntry(entry.id);
      await reloadEntries();
    },
    async log(entry: MealPlanEntry) {
      if (entry.recipeId) {
        const recipe = await recipes.get(entry.recipeId);
        if (!recipe) throw new Error('Recipe was not found.');
        const ingredients = await recipes.listIngredients(recipe.id);
        const nutrition = nutritionPerServing(ingredients, recipe.servings);
        await diary.createEntry({
          id: createId(),
          dayDate: entry.dayDate,
          section: entry.section,
          foodId: null,
          customLabel: recipe.title,
          quantity: entry.quantity,
          unit: 'serving',
          gramsResolved: null,
          energyKcal: nutrition.energyKcal === null ? null : nutrition.energyKcal * entry.quantity,
          proteinG: nutrition.proteinG === null ? null : nutrition.proteinG * entry.quantity,
          carbsG: nutrition.carbsG === null ? null : nutrition.carbsG * entry.quantity,
          fatG: nutrition.fatG === null ? null : nutrition.fatG * entry.quantity,
          satFatG: null,
          fiberG: null,
          sugarG: null,
          sodiumMg: null,
          microsSnapshot: null,
          loggedVia: 'plan',
          deletedAt: null,
        });
      } else if (entry.foodId) {
        const food = await foods.get(entry.foodId);
        if (!food) throw new Error('Food was not found.');
        const snapshot = foodSnapshotForGrams(food, entry.quantity);
        await diary.createEntry({
          id: createId(),
          dayDate: entry.dayDate,
          section: entry.section,
          foodId: food.id,
          customLabel: null,
          quantity: entry.quantity,
          unit: 'g',
          gramsResolved: entry.quantity,
          ...snapshot,
          loggedVia: 'plan',
          deletedAt: null,
        });
      } else if (entry.templateId) {
        const items = await templates.listItems(entry.templateId);
        await database.withTransactionAsync(async (transaction) => {
          const transactionDiary = createDiaryRepository(transaction);
          for (const item of items) {
            const food = await foods.get(item.foodId);
            if (!food) continue;
            const grams = item.grams * entry.quantity;
            await transactionDiary.createEntry({
              id: createId(),
              dayDate: entry.dayDate,
              section: entry.section,
              foodId: food.id,
              customLabel: null,
              quantity: grams,
              unit: 'g',
              gramsResolved: grams,
              ...foodSnapshotForGrams(food, grams),
              loggedVia: 'plan',
              deletedAt: null,
            });
          }
        });
      }
    },
    async copyToNextWeek() {
      if (state.status !== 'ready') return;
      const targetStart = addDays(weekStart, 7);
      await plans.replaceWeek(
        state.plan.id,
        { id: createId(), weekStart: targetStart },
        state.entries.map((entry) => addDays(entry.dayDate, 7)),
        state.entries.map(() => createId()),
      );
    },
    async generateGroceries(listName: string) {
      if (state.status !== 'ready') return;
      const list = await groceries.create({ id: createId(), name: listName });
      const additions: GroceryItemWrite[] = [];
      for (const entry of state.entries) {
        if (entry.recipeId) {
          const recipe = await recipes.get(entry.recipeId);
          if (!recipe) continue;
          const ingredients = await recipes.listIngredients(recipe.id);
          const factor = entry.quantity / recipe.servings;
          for (const ingredient of ingredients) {
            additions.push({
              id: createId(),
              listId: list.id,
              foodId: ingredient.foodId,
              label: ingredient.label,
              quantity: ingredient.quantity * factor,
              unit: ingredient.unit,
              gramsResolved:
                ingredient.gramsResolved === null ? null : ingredient.gramsResolved * factor,
              isChecked: false,
              position: additions.length,
            });
          }
        } else if (entry.foodId) {
          additions.push({
            id: createId(),
            listId: list.id,
            foodId: entry.foodId,
            label: entry.label,
            quantity: entry.quantity,
            unit: 'g',
            gramsResolved: entry.quantity,
            isChecked: false,
            position: additions.length,
          });
        } else if (entry.templateId) {
          const items = await templates.listItems(entry.templateId);
          for (const item of items) {
            const food = await foods.get(item.foodId);
            if (!food) continue;
            const grams = item.grams * entry.quantity;
            additions.push({
              id: createId(),
              listId: list.id,
              foodId: food.id,
              label: food.name,
              quantity: grams,
              unit: 'g',
              gramsResolved: grams,
              isChecked: false,
              position: additions.length,
            });
          }
        }
      }
      for (const item of combineGroceryItems(additions)) {
        await groceries.saveItem(item);
      }
      return list;
    },
  };
}
