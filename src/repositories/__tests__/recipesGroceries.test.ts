import { initializeDatabase } from '@/db/initialize';
import { createGroceryRepository, createRecipeRepository } from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('recipe and grocery repositories', () => {
  let database: TestDatabase;
  const timestamp = '2026-07-16T08:00:00.000Z';
  const clock = { now: () => timestamp };

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('supports recipe CRUD, ingredients, favorites, and cascade deletion', async () => {
    const repository = createRecipeRepository(database, clock);
    const recipe = await repository.create(
      {
        id: 'user-recipe',
        title: 'My bowl',
        titleEl: null,
        servings: 2,
        prepMinutes: 5,
        cookMinutes: 0,
        instructions: ['Mix'],
        instructionsEl: null,
        dietaryTags: ['vegetarian'],
        allergenTags: ['dairy'],
        source: 'user',
      },
      [
        {
          id: 'ingredient',
          recipeId: 'user-recipe',
          foodId: 'greek-food-071',
          label: 'Greek yogurt',
          quantity: 300,
          unit: 'g',
          gramsResolved: 300,
          position: 0,
        },
      ],
    );
    expect(recipe.source).toBe('user');
    expect(await repository.listIngredients(recipe.id)).toHaveLength(1);
    await repository.setFavorite(recipe.id, true);
    expect((await repository.get(recipe.id))?.isFavorite).toBe(true);

    await repository.update({ ...recipe, title: 'Updated bowl' }, [
      {
        id: 'ingredient-2',
        recipeId: recipe.id,
        foodId: 'greek-food-031',
        label: 'Apple',
        quantity: 180,
        unit: 'g',
        gramsResolved: 180,
        position: 0,
      },
    ]);
    expect((await repository.get(recipe.id))?.title).toBe('Updated bowl');
    await repository.delete(recipe.id);
    expect(await repository.get(recipe.id)).toBeNull();
    expect(await repository.listIngredients(recipe.id)).toEqual([]);
  });

  it('supports multiple grocery lists and checkable manual items', async () => {
    const repository = createGroceryRepository(database, clock);
    const list = await repository.create({ id: 'list', name: 'Weekend' });
    const item = await repository.saveItem({
      id: 'item',
      listId: list.id,
      foodId: null,
      label: 'Soap',
      quantity: 2,
      unit: 'piece',
      gramsResolved: null,
      isChecked: false,
      position: 0,
    });
    expect(await repository.list()).toHaveLength(1);
    expect((await repository.saveItem({ ...item, isChecked: true })).isChecked).toBe(true);
    await repository.delete(list.id);
    expect(await repository.listItems(list.id)).toEqual([]);
  });
});
