import { act, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { initializeAppDatabase } from '@/db/appDatabase';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import type { Database } from '@/db/types';
import { renderWithProviders } from '@/test/render';

jest.mock('@/db/appDatabase', () => ({
  initializeAppDatabase: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

const mockInitialize = jest.mocked(initializeAppDatabase);
const database = {} as Database;

describe('DatabaseProvider', () => {
  beforeEach(() => {
    mockInitialize.mockReset();
  });

  it('does not render database-dependent content while initialization is pending', async () => {
    mockInitialize.mockReturnValue(new Promise(() => undefined));
    const screen = await renderWithProviders(
      <DatabaseProvider>
        <Text>Database content</Text>
      </DatabaseProvider>,
    );

    expect(screen.getByText('Preparing your local data…')).toBeTruthy();
    expect(screen.queryByText('Database content')).toBeNull();
  });

  it('shows a safe error and recovers when retry succeeds', async () => {
    mockInitialize.mockRejectedValueOnce(new Error('raw SQLite detail'));
    mockInitialize.mockResolvedValueOnce(database);
    const screen = await renderWithProviders(
      <DatabaseProvider>
        <Text>Database content</Text>
      </DatabaseProvider>,
    );

    expect(await screen.findByText('Local data is unavailable')).toBeTruthy();
    expect(screen.queryByText('raw SQLite detail')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    });

    expect(await screen.findByText('Database content')).toBeTruthy();
    expect(mockInitialize).toHaveBeenCalledTimes(2);
  });
});
