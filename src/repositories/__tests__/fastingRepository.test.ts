import { initializeDatabase } from '@/db/initialize';
import { createFastingRepository } from '@/repositories';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

describe('fasting and mood repository', () => {
  let database: TestDatabase;
  const clock = { now: () => '2026-07-16T08:00:00.000Z' };

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });
  afterEach(() => database.close());

  it('saves one active plan and validates JSON at the persistence boundary', async () => {
    const repository = createFastingRepository(database, clock);
    const first = await repository.savePlan({
      id: 'first',
      kind: '16_8',
      name: '16:8',
      fastingMinutes: 960,
      eatingMinutes: 480,
      startTime: '20:00',
      fastingWeekdays: [],
      reducedTargetPercent: 75,
      notificationsEnabled: false,
      isActive: true,
    });
    expect(first).toMatchObject({ kind: '16_8', isActive: true, fastingWeekdays: [] });
    await repository.savePlan({
      ...first,
      id: 'second',
      kind: '14_10',
      name: '14:10',
      fastingMinutes: 840,
      eatingMinutes: 600,
    });
    expect(await repository.getActivePlan()).toMatchObject({ id: 'second' });
    await database.runAsync(
      "UPDATE fasting_plans SET fasting_weekdays_json = 'invalid' WHERE id = 'second'",
    );
    await expect(repository.getActivePlan()).rejects.toMatchObject({ code: 'validation' });
  });

  it('creates and completes a session while enforcing only one active timer', async () => {
    const repository = createFastingRepository(database, clock);
    const write = {
      id: 'session',
      planId: null,
      startedAt: '2026-07-16T08:00:00.000Z',
      targetEndAt: '2026-07-17T00:00:00.000Z',
      endedAt: null,
      status: 'active' as const,
      note: null,
      startNotificationId: null,
      endNotificationId: null,
    };
    await expect(repository.createSession(write)).resolves.toMatchObject({ status: 'active' });
    await expect(repository.createSession({ ...write, id: 'second' })).rejects.toBeTruthy();
    await expect(
      repository.updateSession({
        ...write,
        endedAt: '2026-07-17T00:00:00.000Z',
        status: 'completed',
        note: 'Felt fine',
      }),
    ).resolves.toMatchObject({ status: 'completed', note: 'Felt fine' });
  });

  it('stores localized mood tags idempotently and aggregates them', async () => {
    const repository = createFastingRepository(database, clock);
    const tags = await repository.listMoodTags();
    expect(tags).toHaveLength(6);
    await repository.setDayMoodTags('2026-07-16', ['calm', 'focused', 'calm']);
    await repository.setDayMoodTags('2026-07-17', ['calm']);
    expect(await repository.listDayMoodTagIds('2026-07-16')).toEqual(['calm', 'focused']);
    expect(await repository.moodTagSummary('2026-07-01', '2026-07-31')).toMatchObject([
      { tagId: 'calm', nameEl: 'Ήρεμα', count: 2 },
      { tagId: 'focused', count: 1 },
    ]);
  });
});
