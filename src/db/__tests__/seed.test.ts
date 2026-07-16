import { initializeDatabase } from '@/db/initialize';
import { seedDevelopmentData } from '@/db/seed/dev';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

const seedOptions = {
  isDevelopment: true,
  dayDate: '2026-07-16',
  now: '2026-07-16T08:00:00.000Z',
};

describe('development seeds', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it('seeds original Greek examples once and is idempotent', async () => {
    await expect(seedDevelopmentData(database, seedOptions)).resolves.toBe(true);
    await expect(seedDevelopmentData(database, seedOptions)).resolves.toBe(false);

    const foods = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM foods',
    );
    const portions = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM food_portions',
    );
    const entries = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM diary_entries',
    );
    expect(foods?.count).toBe(3);
    expect(portions?.count).toBe(3);
    expect(entries?.count).toBe(2);
  });

  it('never seeds a production database', async () => {
    await expect(
      seedDevelopmentData(database, { ...seedOptions, isDevelopment: false }),
    ).resolves.toBe(false);
    const foods = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM foods',
    );
    expect(foods?.count).toBe(0);
  });
});
