import { addDays, dayKeyOf, diffDays, formatDayKey, isAfterDay, isDayKey } from '..';

describe('isDayKey', () => {
  it.each(['2026-01-01', '2024-02-29', '2026-12-31'])('accepts %s', (k) => {
    expect(isDayKey(k)).toBe(true);
  });

  it.each([
    '2026-2-1', // no padding
    '2026-13-01', // month out of range
    '2026-00-10',
    '2026-02-30', // impossible date
    '2025-02-29', // not a leap year
    '2026/01/01',
    '20260101',
    'not-a-date',
  ])('rejects %s', (k) => {
    expect(isDayKey(k)).toBe(false);
  });
});

describe('dayKeyOf', () => {
  it('uses the local calendar date', () => {
    // Local-time constructor: this is 23:59 local, so the key is that same day.
    expect(dayKeyOf(new Date(2026, 6, 16, 23, 59))).toBe('2026-07-16');
    expect(dayKeyOf(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('addDays', () => {
  it('adds and subtracts across month/year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-07-16', 0)).toBe('2026-07-16');
  });

  it('handles leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is stable across EU DST transition dates (2026-03-29, 2026-10-25)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('throws on invalid keys', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Invalid day key');
  });
});

describe('diffDays / isAfterDay', () => {
  it('computes signed differences', () => {
    expect(diffDays('2026-07-16', '2026-07-17')).toBe(1);
    expect(diffDays('2026-07-17', '2026-07-16')).toBe(-1);
    expect(diffDays('2025-07-16', '2026-07-16')).toBe(365);
  });

  it('flags future days (future logging support, PRODUCT_SPEC §6)', () => {
    expect(isAfterDay('2026-07-17', '2026-07-16')).toBe(true);
    expect(isAfterDay('2026-07-16', '2026-07-16')).toBe(false);
    expect(isAfterDay('2026-07-15', '2026-07-16')).toBe(false);
  });
});

describe('formatDayKey', () => {
  it('localizes for English and Greek', () => {
    expect(formatDayKey('2026-07-16', 'en')).toMatch(/Thursday/);
    expect(formatDayKey('2026-07-16', 'el')).toMatch(/Πέμπτη/);
  });
});
