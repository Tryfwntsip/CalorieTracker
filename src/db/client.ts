import * as SQLite from 'expo-sqlite';

import { DatabaseInitializationError } from '@/db/errors';
import type { Database, DatabaseValue, RunResult } from '@/db/types';

const DATABASE_NAME = 'calorietracker.db';

function adaptDatabase(sqliteDatabase: SQLite.SQLiteDatabase): Database {
  const adapted: Database = {
    execAsync: (sql) => sqliteDatabase.execAsync(sql),
    runAsync: async (sql, ...params) => {
      const result = await sqliteDatabase.runAsync(sql, ...params);
      return {
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowId,
      } satisfies RunResult;
    },
    getFirstAsync: <T>(sql: string, ...params: DatabaseValue[]) =>
      sqliteDatabase.getFirstAsync<T>(sql, ...params),
    getAllAsync: <T>(sql: string, ...params: DatabaseValue[]) =>
      sqliteDatabase.getAllAsync<T>(sql, ...params),
    withTransactionAsync: async <T>(task: (transaction: Database) => Promise<T>) => {
      let result: { value: T } | undefined;
      await sqliteDatabase.withExclusiveTransactionAsync(async (transaction) => {
        result = { value: await task(adaptDatabase(transaction)) };
      });
      if (!result) throw new Error('SQLite transaction completed without a result.');
      return result.value;
    },
  };
  return adapted;
}

let databasePromise: Promise<Database> | null = null;
let nativeDatabase: SQLite.SQLiteDatabase | null = null;

export function openAppDatabase(): Promise<Database> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME)
    .then(async (database) => {
      nativeDatabase = database;
      await database.execAsync('PRAGMA journal_mode = WAL');
      return adaptDatabase(database);
    })
    .catch((error: unknown) => {
      databasePromise = null;
      throw new DatabaseInitializationError('open_failed', { cause: error });
    });

  return databasePromise;
}

export async function resetAppDatabaseConnectionAfterFailure(): Promise<void> {
  databasePromise = null;
  const database = nativeDatabase;
  nativeDatabase = null;
  if (database) {
    await database.closeAsync().catch(() => undefined);
  }
}
