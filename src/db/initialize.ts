import { DatabaseInitializationError, MigrationError } from '@/db/errors';
import { runMigrations } from '@/db/migrate';
import type { Migration } from '@/db/migrations/types';
import type { Database } from '@/db/types';

type ForeignKeysRow = { foreign_keys: number };

export async function configureDatabase(database: Database): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON');
  const row = await database.getFirstAsync<ForeignKeysRow>('PRAGMA foreign_keys');

  if (row?.foreign_keys !== 1) {
    throw new DatabaseInitializationError('configuration_failed');
  }
}

export async function initializeDatabase(
  database: Database,
  migrations?: readonly Migration[],
): Promise<number> {
  try {
    await configureDatabase(database);
    return await runMigrations(database, migrations);
  } catch (error: unknown) {
    if (error instanceof DatabaseInitializationError) throw error;
    if (error instanceof MigrationError) {
      throw new DatabaseInitializationError('migration_failed', {
        cause: error,
        migrationVersion: error.version,
      });
    }
    throw new DatabaseInitializationError('unknown', { cause: error });
  }
}
