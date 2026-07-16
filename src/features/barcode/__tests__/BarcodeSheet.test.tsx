import { act, fireEvent, screen } from '@testing-library/react-native';

import { initializeDatabase } from '@/db/initialize';
import { BarcodeSheet } from '@/features/barcode/BarcodeSheet';
import { createFoodRepository } from '@/repositories';
import type { BarcodeLookupResult } from '@/services/barcode/lookup';
import { renderWithProviders } from '@/test/render';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('BarcodeSheet', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('creates a custom food with the unresolved barcode attached', async () => {
    const unresolved: BarcodeLookupResult = {
      barcode: '4006381333931',
      status: 'not_found',
      food: null,
      errorCode: null,
    };
    await renderWithProviders(
      <BarcodeSheet
        visible
        dayDate="2026-07-16"
        section="breakfast"
        onClose={() => undefined}
        onLogged={async () => undefined}
        lookupService={async () => unresolved}
      />,
      { database },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Enter barcode' }));
    await fireEvent.changeText(screen.getByLabelText('Barcode number'), unresolved.barcode);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Look up barcode' }));
    });
    expect(await screen.findByText('Barcode not found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create food with this barcode' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'My packaged snack');
    await fireEvent.changeText(screen.getByLabelText('Energy per 100 g/ml (kcal)'), '250');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });

    expect(await screen.findByText('Product found')).toBeTruthy();
    await expect(
      createFoodRepository(database).getByBarcode(unresolved.barcode),
    ).resolves.toMatchObject({
      name: 'My packaged snack',
      barcode: unresolved.barcode,
      source: 'user',
    });
  });
});
