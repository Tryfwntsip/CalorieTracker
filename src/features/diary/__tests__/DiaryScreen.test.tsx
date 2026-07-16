import { act, fireEvent, screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { DiaryScreen } from '@/features/diary/DiaryScreen';
import { createSettingsRepository, defaultSettings } from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';
import type { Profile } from '@/types';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});

const profile: Profile = {
  id: 1,
  dateOfBirth: '1990-05-12',
  sex: 'unspecified',
  heightCm: 175,
  currentWeightKg: 75,
  targetWeightKg: 70,
  activityLevel: 3,
  goalType: 'maintain',
  weeklyRateKg: 0,
  calorieTarget: 2200,
  proteinTargetG: 110,
  carbsTargetG: 260,
  fatTargetG: 73,
  createdAt: '2026-07-16T08:00:00.000Z',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

describe('DiaryScreen', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
    await createSettingsRepository(database).create(defaultSettings);
  });

  afterEach(() => database.close());

  it('quick-adds a manual food and updates the diary', async () => {
    await renderWithProviders(<DiaryScreen mode="today" />, { database, profile });
    await screen.findByText('Daily details');

    await fireEvent.press(screen.getByRole('button', { name: 'Manual entry' }));
    await fireEvent.changeText(screen.getByLabelText('Label (optional)'), 'Yogurt');
    await fireEvent.changeText(screen.getByLabelText('Calories (kcal)'), '180');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });

    expect(await screen.findByText('Yogurt')).toBeTruthy();
    expect(screen.getAllByText('180 kcal').length).toBeGreaterThan(0);
  });

  it('finds and logs a Greek catalog food fully offline', async () => {
    await renderWithProviders(<DiaryScreen mode="today" />, { database, profile });
    await screen.findByText('Daily details');

    await fireEvent.press(screen.getByRole('button', { name: 'Quick add food' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'γιγαντες');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Search offline' }));
    });
    const result = await screen.findByText('Giant beans in tomato sauce');
    await fireEvent.press(result);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Log 375 kcal' }));
    });

    expect(await screen.findByText('Giant beans in tomato sauce')).toBeTruthy();
  });

  it('keeps an edited custom serving in sync with portion logging', async () => {
    await renderWithProviders(<DiaryScreen mode="today" />, { database, profile });
    await screen.findByText('Daily details');

    await fireEvent.press(screen.getByRole('button', { name: 'Quick add food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'My foods' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create custom food' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Homemade snack');
    await fireEvent.changeText(screen.getByLabelText('Energy per 100 g/ml (kcal)'), '200');
    await fireEvent.changeText(screen.getByLabelText('Serving name (optional)'), 'bar');
    await fireEvent.changeText(screen.getByLabelText('Serving weight in grams (optional)'), '100');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });

    await fireEvent.press(await screen.findByText('Homemade snack'));
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await fireEvent.press(editButtons[editButtons.length - 1]!);
    await fireEvent.changeText(screen.getByLabelText('Serving weight in grams (optional)'), '80');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });

    await fireEvent.press(await screen.findByText('Homemade snack'));
    expect(await screen.findByRole('button', { name: 'Log 160 kcal' })).toBeTruthy();
  });
});
