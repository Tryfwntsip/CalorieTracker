import type { Migration } from '@/db/migrations/types';

const releasedAt = '2026-07-16T00:00:00.000Z';

const schemaSql = `
CREATE TABLE fasting_plans (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('12_12', '14_10', '16_8', '18_6', '20_4', '5_2', 'adf', 'custom')),
  name TEXT NOT NULL,
  fasting_minutes INTEGER NOT NULL CHECK (fasting_minutes > 0 AND fasting_minutes <= 4320),
  eating_minutes INTEGER NOT NULL CHECK (eating_minutes >= 0 AND eating_minutes <= 10080),
  start_time TEXT NOT NULL,
  fasting_weekdays_json TEXT NOT NULL DEFAULT '[]',
  reduced_target_percent INTEGER NOT NULL DEFAULT 75 CHECK (reduced_target_percent BETWEEN 50 AND 100),
  notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notifications_enabled IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_fasting_plans_one_active
  ON fasting_plans(is_active) WHERE is_active = 1;

CREATE TABLE fasting_sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES fasting_plans(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  target_end_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  note TEXT,
  start_notification_id TEXT,
  end_notification_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'active' AND ended_at IS NULL) OR
    (status IN ('completed', 'cancelled') AND ended_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_fasting_sessions_one_active
  ON fasting_sessions(status) WHERE status = 'active';
CREATE INDEX idx_fasting_sessions_started ON fasting_sessions(started_at DESC);
CREATE INDEX idx_fasting_sessions_plan ON fasting_sessions(plan_id);

CREATE TABLE mood_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_el TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE diary_day_mood_tags (
  day_date TEXT NOT NULL REFERENCES diary_days(date) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES mood_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(day_date, tag_id)
);

CREATE INDEX idx_diary_day_mood_tags_tag ON diary_day_mood_tags(tag_id, day_date);

INSERT INTO mood_tags (id, name, name_el, position, created_at, updated_at) VALUES
  ('calm', 'Calm', 'Ήρεμα', 0, '${releasedAt}', '${releasedAt}'),
  ('energetic', 'Energetic', 'Ενέργεια', 1, '${releasedAt}', '${releasedAt}'),
  ('focused', 'Focused', 'Συγκέντρωση', 2, '${releasedAt}', '${releasedAt}'),
  ('stressed', 'Stressed', 'Άγχος', 3, '${releasedAt}', '${releasedAt}'),
  ('tired', 'Tired', 'Κούραση', 4, '${releasedAt}', '${releasedAt}'),
  ('hungry', 'Hungry', 'Πείνα', 5, '${releasedAt}', '${releasedAt}');
`;

export const fastingMoodMigration: Migration = {
  version: 7,
  name: 'fasting_mood',
  up: async (database) => {
    await database.execAsync(schemaSql);
  },
};
