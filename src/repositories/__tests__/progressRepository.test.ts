import { initializeDatabase } from '@/db/initialize';
import {
  createDiaryRepository,
  createProfileRepository,
  createProgressRepository,
} from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';
import type { DiaryEntryWrite, ProfileWrite } from '@/types';

const profile: ProfileWrite = {
  dateOfBirth: '1990-01-01',
  sex: 'unspecified',
  heightCm: 175,
  currentWeightKg: 80,
  targetWeightKg: 75,
  activityLevel: 3,
  goalType: 'lose',
  weeklyRateKg: 0.5,
  calorieTarget: 2000,
  proteinTargetG: 120,
  carbsTargetG: 220,
  fatTargetG: 70,
};

function entry(id: string, energyKcal: number, deletedAt: string | null): DiaryEntryWrite {
  return {
    id,
    dayDate: '2026-07-15',
    section: 'lunch',
    foodId: null,
    customLabel: 'Aggregate entry',
    quantity: 1,
    unit: 'serving',
    gramsResolved: null,
    energyKcal,
    proteinG: 10,
    carbsG: 20,
    fatG: 5,
    satFatG: null,
    fiberG: null,
    sugarG: null,
    sodiumMg: null,
    microsSnapshot: null,
    loggedVia: 'manual',
    deletedAt,
  };
}

describe('progress repository', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
    await createProfileRepository(database, {
      now: () => '2026-07-01T08:00:00.000Z',
    }).create(profile);
  });

  afterEach(() => database.close());

  it('aggregates history in SQLite and excludes soft-deleted food entries', async () => {
    const diary = createDiaryRepository(database);
    await diary.createEntry(entry('entry-active-1', 400, null));
    await diary.createEntry(entry('entry-active-2', 600, null));
    await diary.createEntry(entry('entry-deleted', 900, '2026-07-15T12:00:00.000Z'));
    await database.runAsync(
      `INSERT INTO weight_records
       (id, day_date, weight_kg, origin, external_uid, created_at, updated_at)
       VALUES ('weight-1', '2026-07-15', 79.5, 'manual', NULL, ?, ?)`,
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T08:00:00.000Z',
    );
    await database.runAsync(
      `INSERT INTO water_records (id, day_date, amount_ml, logged_at, created_at)
       VALUES ('water-1', '2026-07-15', 500, ?, ?),
              ('water-2', '2026-07-15', 750, ?, ?)`,
      '2026-07-15T09:00:00.000Z',
      '2026-07-15T09:00:00.000Z',
      '2026-07-15T10:00:00.000Z',
      '2026-07-15T10:00:00.000Z',
    );
    await database.runAsync(
      `INSERT INTO steps_logs
       (id, day_date, steps, origin, external_uid, created_at, updated_at)
       VALUES ('steps-manual', '2026-07-15', 8000, 'manual', NULL, ?, ?),
              ('steps-health', '2026-07-15', 8500, 'healthkit', 'health-1', ?, ?)`,
      '2026-07-15T11:00:00.000Z',
      '2026-07-15T11:00:00.000Z',
      '2026-07-15T11:00:00.000Z',
      '2026-07-15T11:00:00.000Z',
    );

    const result = await createProgressRepository(database).load('2026-07-01', '2026-07-16');

    expect(result.nutrition).toEqual([
      {
        dayDate: '2026-07-15',
        energyKcal: 1000,
        proteinG: 20,
        carbsG: 40,
        fatG: 10,
        calorieTarget: 2000,
      },
    ]);
    expect(result.weight).toEqual([{ dayDate: '2026-07-15', weightKg: 79.5 }]);
    expect(result.water).toEqual([{ dayDate: '2026-07-15', amountMl: 1250 }]);
    expect(result.steps).toEqual([{ dayDate: '2026-07-15', steps: 8500 }]);
  });
});
