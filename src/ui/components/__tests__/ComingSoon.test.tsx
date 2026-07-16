import { screen } from '@testing-library/react-native';

import { ComingSoon } from '@/ui/components';
import { renderWithProviders } from '@/test/render';

describe('ComingSoon', () => {
  it('states the area is unbuilt and names the delivering milestone', async () => {
    await renderWithProviders(<ComingSoon milestone={7} />);
    expect(screen.getByText('Not built yet')).toBeTruthy();
    expect(screen.getByText(/Coming in milestone 7/)).toBeTruthy();
  });
});
