import { coreSchemaMigration } from '@/db/migrations/001_core_schema';
import { profileGoalHistoryMigration } from '@/db/migrations/002_profile_goal_history';
import { foodDiaryMigration } from '@/db/migrations/003_food_diary';
import type { Migration } from '@/db/migrations/types';

export const migrations: readonly Migration[] = [
  coreSchemaMigration,
  profileGoalHistoryMigration,
  foodDiaryMigration,
];

export const latestMigrationVersion = migrations.at(-1)?.version ?? 0;
