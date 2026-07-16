import type { Migration } from '@/db/migrations/types';

const profileGoalHistorySql = `
CREATE TABLE profile_goal_history (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL DEFAULT 1 CHECK (profile_id = 1)
    REFERENCES profile(id) ON DELETE CASCADE,
  effective_at TEXT NOT NULL,
  goal_type TEXT CHECK (
    goal_type IS NULL OR goal_type IN ('lose', 'maintain', 'gain', 'build_muscle')
  ),
  weekly_rate_kg REAL,
  current_weight_kg REAL CHECK (current_weight_kg IS NULL OR current_weight_kg > 0),
  target_weight_kg REAL CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
  activity_level INTEGER CHECK (activity_level IS NULL OR activity_level BETWEEN 1 AND 5),
  calorie_target INTEGER CHECK (calorie_target IS NULL OR calorie_target > 0),
  protein_target_g INTEGER CHECK (protein_target_g IS NULL OR protein_target_g >= 0),
  carbs_target_g INTEGER CHECK (carbs_target_g IS NULL OR carbs_target_g >= 0),
  fat_target_g INTEGER CHECK (fat_target_g IS NULL OR fat_target_g >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_profile_goal_history_effective
  ON profile_goal_history(effective_at, version);

INSERT INTO profile_goal_history (
  profile_id, effective_at, goal_type, weekly_rate_kg, current_weight_kg,
  target_weight_kg, activity_level, calorie_target, protein_target_g,
  carbs_target_g, fat_target_g, created_at
)
SELECT
  id, updated_at, goal_type, weekly_rate_kg, current_weight_kg,
  target_weight_kg, activity_level, calorie_target, protein_target_g,
  carbs_target_g, fat_target_g, updated_at
FROM profile;
`;

export const profileGoalHistoryMigration: Migration = {
  version: 2,
  name: 'profile_goal_history',
  up: async (database) => {
    await database.execAsync(profileGoalHistorySql);
  },
};
