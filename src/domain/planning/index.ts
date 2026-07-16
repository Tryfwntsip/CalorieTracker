import { addDays, dayKeyOf, type DayKey } from '@/domain/dates';

export function mondayOfWeek(instant: Date): DayKey {
  const day = dayKeyOf(instant);
  const weekday = instant.getDay();
  return addDays(day, -(weekday === 0 ? 6 : weekday - 1));
}

export function weekDays(weekStart: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function shiftWeek(weekStart: DayKey, weeks: number): DayKey {
  return addDays(weekStart, weeks * 7);
}
