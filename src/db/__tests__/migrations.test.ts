import { DatabaseInitializationError } from '@/db/errors';
import { initializeDatabase } from '@/db/initialize';
import { getUserVersion } from '@/db/migrate';
import { latestMigrationVersion, migrations } from '@/db/migrations';
import type { Migration } from '@/db/migrations/types';
import { createTestDatabase, type TestDatabase } from '@/test/sqlite';

const requiredTables = [
  'profile',
  'settings',
  'foods',
  'food_portions',
  'diary_days',
  'diary_entries',
  'weight_records',
  'water_records',
  'scanned_products',
  'barcode_scan_history',
  'profile_goal_history',
];

const requiredIndexes = [
  'idx_foods_source_external_id',
  'idx_foods_barcode',
  'idx_foods_name',
  'idx_foods_name_el',
  'idx_portions_food',
  'idx_entries_day',
  'idx_water_day',
  'idx_scan_history_time',
  'idx_profile_goal_history_effective',
];

describe('SQLite initialization and migrations', () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('initializes a fresh database and repeated initialization is a no-op', async () => {
    await expect(initializeDatabase(database)).resolves.toBe(latestMigrationVersion);

    const initialSchema = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema
       WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );

    await expect(initializeDatabase(database)).resolves.toBe(latestMigrationVersion);
    const repeatedSchema = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema
       WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );

    expect(repeatedSchema).toEqual(initialSchema);
    await expect(getUserVersion(database)).resolves.toBe(latestMigrationVersion);
  });

  it('creates every required table and index', async () => {
    await initializeDatabase(database);
    const tables = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name`,
    );
    const indexes = await database.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'index' ORDER BY name`,
    );

    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining(requiredTables));
    expect(indexes.map(({ name }) => name)).toEqual(expect.arrayContaining(requiredIndexes));
  });

  it('enables foreign keys and enforces cascade behavior', async () => {
    await initializeDatabase(database);
    const pragma = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(pragma?.foreign_keys).toBe(1);

    await expect(
      database.runAsync(
        `INSERT INTO food_portions (id, food_id, label, grams)
         VALUES (?, ?, ?, ?)`,
        'portion',
        'missing-food',
        'serving',
        100,
      ),
    ).rejects.toThrow();

    const timestamp = '2026-07-16T08:00:00.000Z';
    await database.runAsync(
      `INSERT INTO foods (
        id, name, source, quality, is_liquid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'food',
      'Food',
      'user',
      'user_entered',
      0,
      timestamp,
      timestamp,
    );
    await database.runAsync(
      `INSERT INTO food_portions (id, food_id, label, grams) VALUES (?, ?, ?, ?)`,
      'portion',
      'food',
      'serving',
      100,
    );
    await database.runAsync('DELETE FROM foods WHERE id = ?', 'food');
    const portion = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM food_portions WHERE id = ?',
      'portion',
    );
    expect(portion).toBeNull();
  });

  it('sorts and runs pending migrations in numerical order', async () => {
    const executionOrder: number[] = [];
    const ordered: Migration[] = [
      {
        version: 2,
        name: 'insert',
        up: async (transaction) => {
          executionOrder.push(2);
          await transaction.runAsync('INSERT INTO ordered_test (value) VALUES (?)', 'second');
        },
      },
      {
        version: 1,
        name: 'create',
        up: async (transaction) => {
          executionOrder.push(1);
          await transaction.execAsync('CREATE TABLE ordered_test (value TEXT NOT NULL)');
        },
      },
    ];

    await expect(initializeDatabase(database, ordered)).resolves.toBe(2);
    expect(executionOrder).toEqual([1, 2]);
    await expect(getUserVersion(database)).resolves.toBe(2);
  });

  it('upgrades an M2 profile and preserves its current goal as the first history version', async () => {
    await initializeDatabase(database, migrations.slice(0, 1));
    const timestamp = '2026-07-16T08:00:00.000Z';
    await database.runAsync(
      `INSERT INTO profile (
        id, sex, current_weight_kg, goal_type, weekly_rate_kg, calorie_target,
        protein_target_g, carbs_target_g, fat_target_g, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'unspecified',
      75,
      'maintain',
      0,
      2100,
      100,
      250,
      70,
      timestamp,
      timestamp,
    );

    await initializeDatabase(database, migrations);

    const history = await database.getFirstAsync<{
      calorie_target: number;
      effective_at: string;
    }>(
      `SELECT calorie_target, effective_at
       FROM profile_goal_history
       WHERE profile_id = 1`,
    );
    expect(history).toEqual({ calorie_target: 2100, effective_at: timestamp });
  });

  it('rolls back a failing migration and preserves the prior version', async () => {
    await initializeDatabase(database, migrations);
    const failing: Migration = {
      version: 3,
      name: 'deliberate_failure',
      up: async (transaction) => {
        await transaction.execAsync(`
          CREATE TABLE should_rollback (id TEXT PRIMARY KEY);
          INSERT INTO table_that_does_not_exist (id) VALUES ('failure');
        `);
      },
    };

    await expect(initializeDatabase(database, [...migrations, failing])).rejects.toMatchObject({
      code: 'migration_failed',
      migrationVersion: 3,
    } satisfies Partial<DatabaseInitializationError>);

    await expect(getUserVersion(database)).resolves.toBe(latestMigrationVersion);
    const rolledBackTable = await database.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?`,
      'should_rollback',
    );
    expect(rolledBackTable).toBeNull();
  });
});
