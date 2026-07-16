export type BarcodeSymbology = 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'manual';

function digitsOnly(value: string): boolean {
  return /^\d+$/.test(value);
}

export function calculateGtinCheckDigit(payload: string): number | null {
  if (!payload || !digitsOnly(payload)) return null;
  const sum = [...payload]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

export function hasValidGtinCheckDigit(value: string): boolean {
  if (value.length < 2 || !digitsOnly(value)) return false;
  const payload = value.slice(0, -1);
  return calculateGtinCheckDigit(payload) === Number(value.at(-1));
}

function expandUpcE(value: string): string | null {
  if (value.length !== 8) return null;
  const numberSystem = value[0] ?? '';
  const compressed = value.slice(1, 7);
  const suppliedCheckDigit = value[7] ?? null;

  if (!digitsOnly(numberSystem + compressed) || !['0', '1'].includes(numberSystem)) return null;
  const [d1, d2, d3, d4, d5, d6] = compressed;
  if (!d1 || !d2 || !d3 || !d4 || !d5 || !d6) return null;

  const payload =
    d6 === '0' || d6 === '1' || d6 === '2'
      ? `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`
      : d6 === '3'
        ? `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`
        : d6 === '4'
          ? `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`
          : `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const checkDigit = calculateGtinCheckDigit(payload);
  if (checkDigit === null) return null;
  if (suppliedCheckDigit !== null && Number(suppliedCheckDigit) !== checkDigit) return null;
  return `${payload}${checkDigit}`;
}

/**
 * Converts supported retail barcodes into a single GTIN-13 representation.
 * Manual 8-digit input is treated as EAN-8; camera UPC-E events carry their symbology.
 */
export function normalizeBarcode(raw: string, symbology: string = 'manual'): string | null {
  const compact = raw.trim().replace(/[\s-]/g, '');
  if (!compact || !digitsOnly(compact)) return null;
  const normalizedSymbology = symbology.toLowerCase().replace('-', '_');

  if (normalizedSymbology === 'upc_e') {
    const expanded = expandUpcE(compact);
    return expanded === null ? null : `0${expanded}`;
  }

  if (compact.length === 13 && hasValidGtinCheckDigit(compact)) return compact;
  if (compact.length === 12 && hasValidGtinCheckDigit(compact)) return `0${compact}`;
  if (compact.length === 8 && hasValidGtinCheckDigit(compact)) return `00000${compact}`;
  return null;
}
