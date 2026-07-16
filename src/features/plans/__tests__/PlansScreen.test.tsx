import { act, fireEvent, screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { PlansScreen } from '@/features/plans/PlansScreen';
import { createDiaryRepository } from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('PlansScreen', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('opens a seeded recipe, logs it, and combines ingredients into a grocery list', async () => {
    await renderWithProviders(<PlansScreen now={new Date(2026, 6, 16, 12)} />, { database });
    const recipe = await screen.findByText('Lentil and tomato bowl');
    await fireEvent.press(recipe);
    expect(await screen.findByText(/kcal.*per serving/)).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Log 1 serving' }));
    });
    expect((await createDiaryRepository(database).listEntries('2026-07-16'))[0]?.loggedVia).toBe(
      'plan',
    );

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Add ingredients to list' }));
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Grocery lists' }));
    expect(await screen.findByRole('button', { name: 'My groceries' })).toBeTruthy();
    expect(screen.getByText(/Cooked lentils/)).toBeTruthy();
  });
});
