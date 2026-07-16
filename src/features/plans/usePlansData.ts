import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { dayKeyOf } from '@/domain/dates';
import { combineGroceryItems, nutritionPerServing } from '@/domain/recipes';
import { createId } from '@/lib/id';
import {
  createDiaryRepository,
  createFoodRepository,
  createGroceryRepository,
  createRecipeRepository,
} from '@/repositories';
import type {
  Food,
  GroceryItem,
  GroceryList,
  Recipe,
  RecipeIngredient,
  RecipeIngredientWrite,
  RecipeWrite,
} from '@/types';

type ReadyData = {
  recipes: Recipe[];
  groceries: GroceryList[];
  selectedRecipe: Recipe | null;
  ingredients: RecipeIngredient[];
  selectedList: GroceryList | null;
  groceryItems: GroceryItem[];
  foodResults: Food[];
};
type State = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & ReadyData);

export type RecipeDraft = {
  id?: string;
  title: string;
  servings: number;
  ingredients: readonly { food: Food; grams: number }[];
};

export function usePlansData(now: Date) {
  const database = useDatabase();
  const recipesRepository = useMemo(() => createRecipeRepository(database), [database]);
  const groceryRepository = useMemo(() => createGroceryRepository(database), [database]);
  const foodRepository = useMemo(() => createFoodRepository(database), [database]);
  const diaryRepository = useMemo(() => createDiaryRepository(database), [database]);
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const [recipes, groceries] = await Promise.all([
        recipesRepository.list(),
        groceryRepository.list(),
      ]);
      setState({
        status: 'ready',
        recipes,
        groceries,
        selectedRecipe: null,
        ingredients: [],
        selectedList: groceries[0] ?? null,
        groceryItems: groceries[0] ? await groceryRepository.listItems(groceries[0].id) : [],
        foodResults: [],
      });
    } catch {
      setState({ status: 'error' });
    }
  }, [groceryRepository, recipesRepository]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const refreshLists = useCallback(
    async (selectedListId?: string) => {
      const groceries = await groceryRepository.list();
      const selectedList =
        groceries.find(({ id }) => id === selectedListId) ?? groceries[0] ?? null;
      const groceryItems = selectedList ? await groceryRepository.listItems(selectedList.id) : [];
      setState((current) =>
        current.status === 'ready'
          ? { ...current, groceries, selectedList, groceryItems }
          : current,
      );
    },
    [groceryRepository],
  );

  return {
    state,
    retry: load,
    async selectRecipe(recipe: Recipe | null) {
      const ingredients = recipe ? await recipesRepository.listIngredients(recipe.id) : [];
      setState((current) =>
        current.status === 'ready' ? { ...current, selectedRecipe: recipe, ingredients } : current,
      );
    },
    async searchFoods(query: string) {
      const foodResults = await foodRepository.search(query, 10);
      setState((current) => (current.status === 'ready' ? { ...current, foodResults } : current));
    },
    async saveRecipe(draft: RecipeDraft) {
      const id = draft.id ?? createId();
      const existing =
        state.status === 'ready' ? state.recipes.find((recipe) => recipe.id === id) : undefined;
      const recipe: RecipeWrite = {
        id,
        title: draft.title.trim(),
        titleEl: existing?.titleEl ?? null,
        servings: draft.servings,
        prepMinutes: existing?.prepMinutes ?? 0,
        cookMinutes: existing?.cookMinutes ?? 0,
        instructions: existing?.instructions ?? [],
        instructionsEl: existing?.instructionsEl ?? null,
        dietaryTags: existing?.dietaryTags ?? [],
        allergenTags: existing?.allergenTags ?? [],
        source: 'user',
      };
      const ingredients: RecipeIngredientWrite[] = draft.ingredients.map(
        ({ food, grams }, position) => ({
          id: createId(),
          recipeId: id,
          foodId: food.id,
          label: food.name,
          quantity: grams,
          unit: 'g',
          gramsResolved: grams,
          position,
        }),
      );
      if (existing) await recipesRepository.update(recipe, ingredients);
      else await recipesRepository.create(recipe, ingredients);
      await load();
    },
    async deleteRecipe(id: string) {
      await recipesRepository.delete(id);
      await load();
    },
    async renameRecipe(recipe: Recipe, title: string) {
      const ingredients = await recipesRepository.listIngredients(recipe.id);
      await recipesRepository.update(
        {
          id: recipe.id,
          title: title.trim(),
          titleEl: recipe.titleEl,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          instructions: recipe.instructions,
          instructionsEl: recipe.instructionsEl,
          dietaryTags: recipe.dietaryTags,
          allergenTags: recipe.allergenTags,
          source: 'user',
        },
        ingredients.map((ingredient) => ({
          id: ingredient.id,
          recipeId: ingredient.recipeId,
          foodId: ingredient.foodId,
          label: ingredient.label,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          gramsResolved: ingredient.gramsResolved,
          position: ingredient.position,
        })),
      );
      await load();
    },
    async toggleFavorite(recipe: Recipe) {
      await recipesRepository.setFavorite(recipe.id, !recipe.isFavorite);
      await load();
    },
    async logRecipe(recipe: Recipe, ingredients: readonly RecipeIngredient[], servings: number) {
      const perServing = nutritionPerServing(ingredients, recipe.servings);
      const dayDate = dayKeyOf(now);
      await diaryRepository.createEntry({
        id: createId(),
        dayDate,
        section: 'dinner',
        foodId: null,
        customLabel: recipe.title,
        quantity: servings,
        unit: 'serving',
        gramsResolved: null,
        energyKcal: perServing.energyKcal === null ? null : perServing.energyKcal * servings,
        proteinG: perServing.proteinG === null ? null : perServing.proteinG * servings,
        carbsG: perServing.carbsG === null ? null : perServing.carbsG * servings,
        fatG: perServing.fatG === null ? null : perServing.fatG * servings,
        satFatG: null,
        fiberG: null,
        sugarG: null,
        sodiumMg: null,
        microsSnapshot: null,
        loggedVia: 'plan',
        deletedAt: null,
      });
    },
    async createList(name: string) {
      const list = await groceryRepository.create({ id: createId(), name: name.trim() });
      await refreshLists(list.id);
    },
    async selectList(list: GroceryList) {
      const groceryItems = await groceryRepository.listItems(list.id);
      setState((current) =>
        current.status === 'ready' ? { ...current, selectedList: list, groceryItems } : current,
      );
    },
    async deleteList(id: string) {
      await groceryRepository.delete(id);
      await refreshLists();
    },
    async addManualItem(label: string, quantity: number) {
      if (state.status !== 'ready' || !state.selectedList) return;
      await groceryRepository.saveItem({
        id: createId(),
        listId: state.selectedList.id,
        foodId: null,
        label: label.trim(),
        quantity,
        unit: 'piece',
        gramsResolved: null,
        isChecked: false,
        position: state.groceryItems.length,
      });
      await refreshLists(state.selectedList.id);
    },
    async toggleItem(item: GroceryItem) {
      await groceryRepository.saveItem({ ...item, isChecked: !item.isChecked });
      await refreshLists(item.listId);
    },
    async deleteItem(item: GroceryItem) {
      await groceryRepository.deleteItem(item.id);
      await refreshLists(item.listId);
    },
    async addRecipeToGroceries(
      recipeIngredients: readonly RecipeIngredient[],
      defaultListName: string,
    ) {
      let list = state.status === 'ready' ? state.selectedList : null;
      if (!list) {
        list = await groceryRepository.create({ id: createId(), name: defaultListName });
      }
      const existing = await groceryRepository.listItems(list.id);
      const additions = recipeIngredients.map((ingredient, index) => ({
        id: createId(),
        listId: list.id,
        foodId: ingredient.foodId,
        label: ingredient.label,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        gramsResolved: ingredient.gramsResolved,
        isChecked: false,
        position: existing.length + index,
      }));
      const combined = combineGroceryItems([...existing, ...additions]);
      for (const item of existing) await groceryRepository.deleteItem(item.id);
      for (const item of combined) await groceryRepository.saveItem(item);
      await refreshLists(list.id);
    },
  };
}
