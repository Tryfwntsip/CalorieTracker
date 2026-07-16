import { fireEvent, waitFor } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { createProfileRepository } from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';
import { renderWithProviders, testI18n } from '@/test/render';

describe('ProfileForm onboarding', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    await testI18n.changeLanguage('en');
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it('calculates and persists a safe profile through the three-step flow', async () => {
    const onSaved = jest.fn();
    const screen = await renderWithProviders(
      <ProfileForm mode="onboarding" onSaved={onSaved} asOfDay="2026-07-16" />,
      { database },
    );

    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '1990-05-12');
    await fireEvent.press(screen.getByRole('radio', { name: 'Male' }));
    await fireEvent.changeText(screen.getByLabelText('Height (cm)'), '175');
    await fireEvent.changeText(screen.getByLabelText('Current weight (kg)'), '75');
    await fireEvent.press(screen.getByRole('radio', { name: 'Moderately active' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Your goal')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lose weight' }));
    await fireEvent.changeText(screen.getByLabelText('Target weight (kg)'), '70');
    await fireEvent.changeText(screen.getByLabelText('Weekly pace (kg)'), '0.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Calculate targets' }));

    expect(screen.getByText('Daily targets')).toBeTruthy();
    expect(screen.getByLabelText('Calories').props.value).toBe('2037');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await expect(createProfileRepository(database).get()).resolves.toMatchObject({
      dateOfBirth: '1990-05-12',
      goalType: 'lose',
      weeklyRateKg: -0.5,
      calorieTarget: 2037,
    });
  });

  it('shows validation instead of advancing when required values are missing', async () => {
    const screen = await renderWithProviders(
      <ProfileForm mode="onboarding" onSaved={jest.fn()} asOfDay="2026-07-16" />,
      { database },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Check the information and use valid metric values.')).toBeTruthy();
    expect(screen.queryByText('Your goal')).toBeNull();
  });
});
