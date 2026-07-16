import { screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import {
  createDiaryRepository,
  createProfileRepository,
  createSettingsRepository,
  defaultSettings,
} from '@/repositories';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});

describe('ProgressScreen', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
    await createSettingsRepository(database).create(defaultSettings);
    await createProfileRepository(database, {
      now: () => '2026-07-01T08:00:00.000Z',
    }).create({
      dateOfBirth: '1990-01-01',
      sex: 'unspecified',
      heightCm: 175,
      currentWeightKg: 80,
      targetWeightKg: 75,
      activityLevel: 3,
      goalType: 'lose',
      weeklyRateKg: 0.5,
      calorieTarget: 2000,
      proteinTargetG: 120,
      carbsTargetG: 220,
      fatTargetG: 70,
    });
    await createDiaryRepository(database).createEntry({
      id: 'progress-entry',
      dayDate: '2026-07-15',
      section: 'dinner',
      foodId: null,
      customLabel: 'Dinner',
      quantity: 1,
      unit: 'serving',
      gramsResolved: null,
      energyKcal: 1800,
      proteinG: 100,
      carbsG: 200,
      fatG: 60,
      satFatG: null,
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
      microsSnapshot: null,
      loggedVia: 'manual',
      deletedAt: null,
    });
  });

  afterEach(() => database.close());

  it('shows calculated summaries and recorded nutrition from SQLite', async () => {
    await renderWithProviders(<ProgressScreen now={new Date(2026, 6, 16, 12)} />, { database });

    expect(await screen.findByText('Calories vs target')).toBeTruthy();
    expect(
      screen.getByText('1800 kcal average vs 2000 kcal target across 1 logged days.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Recorded').length).toBeGreaterThan(0);
    expect(screen.getByText('Calculated target')).toBeTruthy();
    expect(screen.getByText('Estimated rate')).toBeTruthy();
  });
});
