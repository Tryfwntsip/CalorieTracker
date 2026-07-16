export type DatabaseErrorCode =
  'open_failed' | 'configuration_failed' | 'migration_failed' | 'seed_failed' | 'unknown';

export class DatabaseInitializationError extends Error {
  readonly code: DatabaseErrorCode;
  readonly migrationVersion?: number;

  constructor(code: DatabaseErrorCode, options?: { cause?: unknown; migrationVersion?: number }) {
    super('The local database could not be prepared.');
    this.name = 'DatabaseInitializationError';
    this.code = code;
    this.migrationVersion = options?.migrationVersion;
    this.cause = options?.cause;
  }
}

export class MigrationError extends Error {
  readonly version: number;

  constructor(version: number, cause: unknown) {
    super(`Database migration ${version} failed.`);
    this.name = 'MigrationError';
    this.version = version;
    this.cause = cause;
  }
}
