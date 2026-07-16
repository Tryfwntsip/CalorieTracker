import { fireEvent, screen } from '@testing-library/react-native';

import { ListRow } from '@/ui/components';
import { renderWithProviders } from '@/test/render';

describe('ListRow', () => {
  it('renders title and subtitle', async () => {
    await renderWithProviders(<ListRow title="Breakfast" subtitle="420 kcal" />);
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('420 kcal')).toBeTruthy();
  });

  it('is pressable when onPress is provided', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<ListRow title="Lunch" onPress={onPress} testID="row" />);
    await fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
