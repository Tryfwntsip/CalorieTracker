import { DatabaseSync } from 'node:sqlite';

import type { Database, DatabaseValue, RunResult } from '@/db/types';

export type TestDatabase = Database & {
  close: () => void;
};

export function createTestDatabase(): TestDatabase {
  const sqlite = new DatabaseSync(':memory:');

  const database: TestDatabase = {
    execAsync: async (sql) => {
      sqlite.exec(sql);
    },
    runAsync: async (sql, ...params) => {
      const result = sqlite.prepare(sql).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      } satisfies RunResult;
    },
    getFirstAsync: async <T>(sql: string, ...params: DatabaseValue[]) => {
      const row = sqlite.prepare(sql).get(...params);
      return row === undefined ? null : (row as T);
    },
    getAllAsync: async <T>(sql: string, ...params: DatabaseValue[]) =>
      sqlite.prepare(sql).all(...params) as T[],
    withTransactionAsync: async <T>(task: (transaction: Database) => Promise<T>) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await task(database);
        sqlite.exec('COMMIT');
        return result;
      } catch (error: unknown) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => sqlite.close(),
  };

  return database;
}
