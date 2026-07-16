import { mondayOfWeek, shiftWeek, weekDays } from '@/domain/planning';

describe('meal planning dates', () => {
  it.each([
    [new Date(2026, 6, 13, 12), '2026-07-13'],
    [new Date(2026, 6, 16, 12), '2026-07-13'],
    [new Date(2026, 6, 19, 12), '2026-07-13'],
  ])('resolves Monday for %s', (date, expected) => {
    expect(mondayOfWeek(date)).toBe(expected);
  });

  it('builds and shifts complete weeks deterministically', () => {
    expect(weekDays('2026-07-13')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ]);
    expect(shiftWeek('2026-07-13', 1)).toBe('2026-07-20');
  });
});
