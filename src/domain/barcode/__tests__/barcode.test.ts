import {
  calculateGtinCheckDigit,
  hasValidGtinCheckDigit,
  normalizeBarcode,
} from '@/domain/barcode';

describe('barcode normalization', () => {
  it.each([
    ['EAN-13', '3017620422003', 'manual', '3017620422003'],
    ['EAN-8', '96385074', 'ean8', '0000096385074'],
    ['UPC-A', '034000470693', 'upc_a', '0034000470693'],
    ['UPC-E', '01234558', 'upc_e', '0012345000058'],
    ['spaced manual input', '3017 6204-22003', 'manual', '3017620422003'],
  ])('normalizes %s into GTIN-13', (_label, input, type, expected) => {
    expect(normalizeBarcode(input, type)).toBe(expected);
  });

  it.each(['3017620422004', '96385075', 'hello', '12345', ''])(
    'rejects invalid or unsupported input %s',
    (input) => {
      expect(normalizeBarcode(input)).toBeNull();
    },
  );

  it('calculates and validates GTIN check digits deterministically', () => {
    expect(calculateGtinCheckDigit('301762042200')).toBe(3);
    expect(hasValidGtinCheckDigit('3017620422003')).toBe(true);
    expect(hasValidGtinCheckDigit('3017620422004')).toBe(false);
  });
});
