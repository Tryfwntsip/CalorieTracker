import type { Database } from '@/db/types';

export type Migration = {
  version: number;
  name: string;
  up: (database: Database) => Promise<void>;
};
