import { ageOnDate } from '@/domain/goals';

describe('ageOnDate', () => {
  it('uses the birthday rather than a fixed year difference', () => {
    expect(ageOnDate('1990-07-17', '2026-07-16')).toBe(35);
    expect(ageOnDate('1990-07-16', '2026-07-16')).toBe(36);
  });

  it('handles leap-day birthdays deterministically', () => {
    expect(ageOnDate('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageOnDate('2000-02-29', '2026-03-01')).toBe(26);
  });
});
