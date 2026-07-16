import { isDayKey, type DayKey } from '@/domain/dates';

export function ageOnDate(dateOfBirth: DayKey, asOf: DayKey): number {
  if (!isDayKey(dateOfBirth) || !isDayKey(asOf)) {
    throw new Error('Age calculation requires valid day keys.');
  }

  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [year, month, day] = asOf.split('-').map(Number);
  let age = year! - birthYear!;
  if (month! < birthMonth! || (month === birthMonth && day! < birthDay!)) {
    age -= 1;
  }
  return age;
}
