import { act, fireEvent, screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { MealPlanner } from '@/features/plans/MealPlanner';
import {
  createDiaryRepository,
  createGroceryRepository,
  createMealPlanRepository,
} from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('MealPlanner', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('plans a recipe, logs it, creates groceries, and copies the week', async () => {
    await renderWithProviders(<MealPlanner now={new Date(2026, 6, 16, 12)} />, { database });
    await screen.findByText('Monday, July 13');

    await fireEvent.press(screen.getAllByRole('button', { name: 'Add planned meal' })[0]!);
    await fireEvent.press(await screen.findByRole('button', { name: 'Lentil and tomato bowl' }));
    expect(await screen.findByText('Lentil and tomato bowl')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Add to diary' }));
    });
    expect(await createDiaryRepository(database).listEntries('2026-07-13')).toMatchObject([
      { section: 'breakfast', loggedVia: 'plan', customLabel: 'Lentil and tomato bowl' },
    ]);

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Create grocery list' }));
    });
    const lists = await createGroceryRepository(database).list();
    expect(lists).toHaveLength(1);
    expect(await createGroceryRepository(database).listItems(lists[0]!.id)).toHaveLength(3);

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Copy to next week' }));
    });
    const next = await createMealPlanRepository(database).getByWeek('2026-07-20');
    expect(next).not.toBeNull();
    expect(await createMealPlanRepository(database).listEntries(next!.id)).toMatchObject([
      { dayDate: '2026-07-20', recipeId: 'seed-recipe-001' },
    ]);
  });
});
