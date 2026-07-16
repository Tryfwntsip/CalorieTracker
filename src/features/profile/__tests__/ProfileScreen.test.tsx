import { fireEvent, screen } from '@testing-library/react-native';

import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { renderWithProviders, testI18n } from '@/test/render';

describe('ProfileScreen', () => {
  afterEach(async () => {
    await testI18n.changeLanguage('en');
  });

  it('shows appearance settings and the medical disclaimer', async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText(/not medical advice/)).toBeTruthy();
  });

  it('selects a theme preference', async () => {
    await renderWithProviders(<ProfileScreen />);
    const dark = screen.getByRole('radio', { name: 'Dark' });
    await fireEvent.press(dark);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeSelected();
  });

  it('switches the app language to Greek', async () => {
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ελληνικά' }));
    expect(await screen.findByText('Εμφάνιση')).toBeTruthy();
  });
});
