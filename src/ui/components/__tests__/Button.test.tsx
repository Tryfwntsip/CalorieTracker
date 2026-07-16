import { fireEvent, screen } from '@testing-library/react-native';

import { Button } from '@/ui/components';
import { renderWithProviders } from '@/test/render';

describe('Button', () => {
  it('renders its label and fires onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" onPress={onPress} testID="btn" />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" onPress={onPress} disabled testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('shows a spinner instead of the label while loading and blocks presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" onPress={onPress} loading testID="btn" />);
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.getByTestId('btn-spinner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
