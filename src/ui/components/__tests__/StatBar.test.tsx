import { screen } from '@testing-library/react-native';

import { StatBar, clampProgress } from '@/ui/components';
import { renderWithProviders } from '@/test/render';

describe('clampProgress', () => {
  it.each([
    [0.5, 0.5],
    [-0.2, 0],
    [1.7, 1],
    [0, 0],
    [1, 1],
    [NaN, 0],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampProgress(input)).toBe(expected);
  });
});

describe('StatBar', () => {
  it('shows label and value text', async () => {
    await renderWithProviders(
      <StatBar label="Protein" valueText="82 / 120 g" progress={0.68} testID="bar" />,
    );
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('82 / 120 g')).toBeTruthy();
  });

  it('clamps overfilled bars to 100% width', async () => {
    await renderWithProviders(
      <StatBar label="Carbs" valueText="300 / 200 g" progress={1.5} testID="bar" />,
    );
    expect(screen.getByTestId('bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('exposes an accessible progress value', async () => {
    await renderWithProviders(
      <StatBar label="Fat" valueText="10 / 60 g" progress={0.25} testID="bar" />,
    );
    expect(screen.getByTestId('bar')).toHaveAccessibilityValue({ now: 25 });
  });
});
