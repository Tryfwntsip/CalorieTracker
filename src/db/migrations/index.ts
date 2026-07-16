import { coreSchemaMigration } from '@/db/migrations/001_core_schema';
import type { Migration } from '@/db/migrations/types';

export const migrations: readonly Migration[] = [coreSchemaMigration];

export const latestMigrationVersion = migrations.at(-1)?.version ?? 0;
