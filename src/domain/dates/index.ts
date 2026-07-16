/**
 * Diary-day keying (DATA_MODEL conventions): a diary day is the user's LOCAL
 * calendar date, represented as 'YYYY-MM-DD'. All functions are pure — time
 * is always passed in (AGENTS.md rule 6).
 */

export type DayKey = string; // 'YYYY-MM-DD'

const DAY_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDayKey(value: string): value is DayKey {
  if (!DAY_KEY_RE.test(value)) return false;
  // Reject impossible dates like 2026-02-30 via round-trip.
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

/** Local calendar date of the given instant, in the device timezone. */
export function dayKeyOf(instant: Date): DayKey {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, '0');
  const d = String(instant.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function assertDayKey(key: string): void {
  if (!isDayKey(key)) throw new Error(`Invalid day key: ${key}`);
}

/** Add (or subtract) whole days. DST-safe because math is done in UTC. */
export function addDays(key: DayKey, days: number): DayKey {
  assertDayKey(key);
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Signed whole-day difference b − a. */
export function diffDays(a: DayKey, b: DayKey): number {
  assertDayKey(a);
  assertDayKey(b);
  const toUtc = (k: DayKey) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function isAfterDay(key: DayKey, reference: DayKey): boolean {
  return diffDays(reference, key) > 0;
}

/** Human-readable date for headers, localized. */
export function formatDayKey(key: DayKey, locale: string): string {
  assertDayKey(key);
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}
