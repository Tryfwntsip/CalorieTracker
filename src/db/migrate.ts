import { MigrationError } from '@/db/errors';
import { migrations as productionMigrations } from '@/db/migrations';
import type { Migration } from '@/db/migrations/types';
import type { Database } from '@/db/types';

type UserVersionRow = { user_version: number };

export async function getUserVersion(database: Database): Promise<number> {
  const row = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

function orderedMigrations(migrations: readonly Migration[]): Migration[] {
  const ordered = [...migrations].sort((left, right) => left.version - right.version);
  const seen = new Set<number>();

  for (const migration of ordered) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
      throw new Error('Migration versions must be positive integers.');
    }
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}.`);
    }
    seen.add(migration.version);
  }

  return ordered;
}

export async function runMigrations(
  database: Database,
  migrations: readonly Migration[] = productionMigrations,
): Promise<number> {
  let currentVersion = await getUserVersion(database);

  for (const migration of orderedMigrations(migrations)) {
    if (migration.version <= currentVersion) continue;

    try {
      await database.withTransactionAsync(async (transaction) => {
        await migration.up(transaction);
        await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error: unknown) {
      throw new MigrationError(migration.version, error);
    }

    currentVersion = migration.version;
  }

  return currentVersion;
}
