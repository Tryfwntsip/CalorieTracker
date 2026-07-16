import { fireEvent, screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { FastingPanel } from '@/features/plans/FastingPanel';
import { createFastingRepository } from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('FastingPanel', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('chooses a plan, starts a timer, and saves an early-ended session', async () => {
    await renderWithProviders(<FastingPanel now={new Date('2026-07-16T08:00:00.000Z')} />, {
      database,
    });
    await screen.findByText('Choose a fasting pattern before starting the timer.');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose fasting plan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('16:8');
    await fireEvent.press(screen.getByRole('button', { name: 'Start fast' }));
    await screen.findByText('Fasting');
    await fireEvent.press(screen.getByRole('button', { name: 'Stop fast' }));
    await screen.findByText('The session was saved in your local history.');
    expect(await createFastingRepository(database).listSessions()).toMatchObject([
      { status: 'cancelled' },
    ]);
  });
});
