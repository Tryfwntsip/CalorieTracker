import { initializeDatabase } from '@/db/initialize';
import { prepareProfileTargets, ProfileSaveError, saveProfile } from '@/services/profile';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

const safeForm = {
  dateOfBirth: '1990-05-12',
  sex: 'unspecified',
  heightCm: '175',
  currentWeightKg: '75',
  activityLevel: 3,
  targetWeightKg: '70',
  goalType: 'maintain',
  weeklyPaceKg: '0',
  calorieTarget: '2200',
  proteinTargetG: '100',
  carbsTargetG: '260',
  fatTargetG: '75',
} as const;

describe('profile service', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it('prepares deterministic targets from form data', () => {
    expect(prepareProfileTargets(safeForm, '2026-07-16')).toMatchObject({
      age: 36,
      signedWeeklyRateKg: 0,
      calculation: {
        bmrKcal: 1586,
        maintenanceKcal: 2458,
        calorieTarget: 2458,
      },
    });
  });

  it('creates and then updates the singleton profile with goal history', async () => {
    const created = await saveProfile(database, safeForm, {
      asOfDay: '2026-07-16',
      confirmedAggressive: false,
    });
    const updated = await saveProfile(
      database,
      { ...safeForm, calorieTarget: '2300' },
      { asOfDay: '2026-07-16', confirmedAggressive: false },
    );
    expect(created.calorieTarget).toBe(2200);
    expect(updated.calorieTarget).toBe(2300);

    const count = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM profile_goal_history',
    );
    expect(count?.count).toBe(2);
  });

  it('never allows UI confirmation to bypass a blocked target', async () => {
    await expect(
      saveProfile(
        database,
        { ...safeForm, calorieTarget: '1199' },
        { asOfDay: '2026-07-16', confirmedAggressive: true },
      ),
    ).rejects.toMatchObject({
      code: 'blocked',
      guardrail: {
        status: 'blocked',
        blockedReasons: ['calories_too_low'],
        confirmationReasons: [],
      },
    } satisfies Partial<ProfileSaveError>);
  });

  it('requires explicit confirmation for an aggressive but permitted target', async () => {
    const lowTarget = { ...safeForm, calorieTarget: '1500' };
    await expect(
      saveProfile(database, lowTarget, {
        asOfDay: '2026-07-16',
        confirmedAggressive: false,
      }),
    ).rejects.toMatchObject({ code: 'confirmation_required' });

    await expect(
      saveProfile(database, lowTarget, {
        asOfDay: '2026-07-16',
        confirmedAggressive: true,
      }),
    ).resolves.toMatchObject({ calorieTarget: 1500 });
  });

  it('enforces adult DOB and the explicit protein floor', async () => {
    await expect(
      saveProfile(
        database,
        { ...safeForm, dateOfBirth: '2010-01-01' },
        { asOfDay: '2026-07-16', confirmedAggressive: false },
      ),
    ).rejects.toMatchObject({ code: 'invalid_age' });

    await expect(
      saveProfile(
        database,
        { ...safeForm, proteinTargetG: '59' },
        { asOfDay: '2026-07-16', confirmedAggressive: false },
      ),
    ).rejects.toMatchObject({ code: 'protein_below_floor', minimumProteinG: 60 });
  });
});
