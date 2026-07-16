import { openAppDatabase, resetAppDatabaseConnectionAfterFailure } from '@/db/client';
import { DatabaseInitializationError } from '@/db/errors';
import { initializeDatabase } from '@/db/initialize';
import { ensureSettings } from '@/db/preferences';
import { seedDevelopmentData } from '@/db/seed/dev';
import type { Database } from '@/db/types';
import { dayKeyOf } from '@/domain/dates';

let activeDatabase: Database | null = null;

export async function initializeAppDatabase(): Promise<Database> {
  try {
    const database = await openAppDatabase();
    await initializeDatabase(database);
    await ensureSettings(database);
    const now = new Date();
    await seedDevelopmentData(database, {
      isDevelopment: __DEV__,
      dayDate: dayKeyOf(now),
      now: now.toISOString(),
    });
    activeDatabase = database;
    return database;
  } catch (error: unknown) {
    activeDatabase = null;
    await resetAppDatabaseConnectionAfterFailure();
    if (error instanceof DatabaseInitializationError) throw error;
    throw new DatabaseInitializationError('seed_failed', { cause: error });
  }
}

export function getActiveDatabase(): Database | null {
  return activeDatabase;
}
