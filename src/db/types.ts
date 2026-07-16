export type DatabaseValue = string | number | null | Uint8Array;

export type RunResult = {
  changes: number;
  lastInsertRowId: number;
};

/**
 * Small common surface implemented by expo-sqlite in production and a real
 * SQLite engine in integration tests.
 */
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: DatabaseValue[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, ...params: DatabaseValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: DatabaseValue[]): Promise<T[]>;
  withTransactionAsync<T>(task: (transaction: Database) => Promise<T>): Promise<T>;
}
