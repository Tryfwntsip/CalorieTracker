import type { Database } from '@/db/types';
import { mapRepositoryError, parseRecord } from '@/repositories/errors';
import { encodeJson, systemClock, type Clock } from '@/repositories/shared';
import {
  fastingPlanSchema,
  fastingSessionSchema,
  moodTagAggregateSchema,
  moodTagSchema,
  type MoodTagAggregate,
} from '@/schemas';
import type {
  FastingPlan,
  FastingPlanWrite,
  FastingSession,
  FastingSessionWrite,
  MoodTag,
} from '@/types';

const selectPlan = `
SELECT id, kind, name, fasting_minutes AS fastingMinutes, eating_minutes AS eatingMinutes,
  start_time AS startTime, fasting_weekdays_json AS fastingWeekdays,
  reduced_target_percent AS reducedTargetPercent,
  notifications_enabled AS notificationsEnabled, is_active AS isActive,
  created_at AS createdAt, updated_at AS updatedAt
FROM fasting_plans`;

const selectSession = `
SELECT id, plan_id AS planId, started_at AS startedAt, target_end_at AS targetEndAt,
  ended_at AS endedAt, status, note, start_notification_id AS startNotificationId,
  end_notification_id AS endNotificationId, created_at AS createdAt, updated_at AS updatedAt
FROM fasting_sessions`;

function parsePlan(row: unknown): FastingPlan {
  return parseRecord(fastingPlanSchema, row, 'fasting_plan');
}

export interface FastingRepository {
  listPlans(): Promise<FastingPlan[]>;
  getActivePlan(): Promise<FastingPlan | null>;
  savePlan(plan: FastingPlanWrite): Promise<FastingPlan>;
  getActiveSession(): Promise<FastingSession | null>;
  listSessions(limit?: number): Promise<FastingSession[]>;
  createSession(session: FastingSessionWrite): Promise<FastingSession>;
  updateSession(session: FastingSessionWrite): Promise<FastingSession>;
  listMoodTags(): Promise<MoodTag[]>;
  listDayMoodTagIds(dayDate: string): Promise<string[]>;
  setDayMoodTags(dayDate: string, tagIds: readonly string[]): Promise<void>;
  moodTagSummary(fromDay: string, toDay: string): Promise<MoodTagAggregate[]>;
}

export function createFastingRepository(
  database: Database,
  clock: Clock = systemClock,
): FastingRepository {
  const getSession = async (id: string) => {
    const row = await database.getFirstAsync<unknown>(`${selectSession} WHERE id = ?`, id);
    return row === null ? null : parseRecord(fastingSessionSchema, row, 'fasting_session');
  };

  return {
    async listPlans() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectPlan} ORDER BY is_active DESC, updated_at DESC`,
        );
        return rows.map(parsePlan);
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_plan');
      }
    },
    async getActivePlan() {
      try {
        const row = await database.getFirstAsync<unknown>(`${selectPlan} WHERE is_active = 1`);
        return row === null ? null : parsePlan(row);
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_plan');
      }
    },
    async savePlan(plan) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          if (plan.isActive) {
            await transaction.runAsync(
              'UPDATE fasting_plans SET is_active = 0, updated_at = ? WHERE is_active = 1 AND id <> ?',
              now,
              plan.id,
            );
          }
          await transaction.runAsync(
            `INSERT INTO fasting_plans (
              id, kind, name, fasting_minutes, eating_minutes, start_time,
              fasting_weekdays_json, reduced_target_percent, notifications_enabled,
              is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, name = excluded.name,
              fasting_minutes = excluded.fasting_minutes, eating_minutes = excluded.eating_minutes,
              start_time = excluded.start_time, fasting_weekdays_json = excluded.fasting_weekdays_json,
              reduced_target_percent = excluded.reduced_target_percent,
              notifications_enabled = excluded.notifications_enabled,
              is_active = excluded.is_active, updated_at = excluded.updated_at`,
            plan.id,
            plan.kind,
            plan.name,
            plan.fastingMinutes,
            plan.eatingMinutes,
            plan.startTime,
            encodeJson(plan.fastingWeekdays),
            plan.reducedTargetPercent,
            plan.notificationsEnabled ? 1 : 0,
            plan.isActive ? 1 : 0,
            now,
            now,
          );
        });
        const row = await database.getFirstAsync<unknown>(`${selectPlan} WHERE id = ?`, plan.id);
        if (!row) throw new Error('Saved fasting plan was not found.');
        return parsePlan(row);
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_plan');
      }
    },
    async getActiveSession() {
      try {
        const row = await database.getFirstAsync<unknown>(
          `${selectSession} WHERE status = 'active'`,
        );
        return row === null ? null : parseRecord(fastingSessionSchema, row, 'fasting_session');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_session');
      }
    },
    async listSessions(limit = 50) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectSession} ORDER BY started_at DESC LIMIT ?`,
          limit,
        );
        return rows.map((row) => parseRecord(fastingSessionSchema, row, 'fasting_session'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_session');
      }
    },
    async createSession(session) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO fasting_sessions (
            id, plan_id, started_at, target_end_at, ended_at, status, note,
            start_notification_id, end_notification_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          session.id,
          session.planId,
          session.startedAt,
          session.targetEndAt,
          session.endedAt,
          session.status,
          session.note,
          session.startNotificationId,
          session.endNotificationId,
          now,
          now,
        );
        const result = await getSession(session.id);
        if (!result) throw new Error('Created fasting session was not found.');
        return result;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_session');
      }
    },
    async updateSession(session) {
      try {
        await database.runAsync(
          `UPDATE fasting_sessions SET plan_id = ?, started_at = ?, target_end_at = ?,
            ended_at = ?, status = ?, note = ?, start_notification_id = ?,
            end_notification_id = ?, updated_at = ? WHERE id = ?`,
          session.planId,
          session.startedAt,
          session.targetEndAt,
          session.endedAt,
          session.status,
          session.note,
          session.startNotificationId,
          session.endNotificationId,
          clock.now(),
          session.id,
        );
        const result = await getSession(session.id);
        if (!result) throw new Error('Updated fasting session was not found.');
        return result;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'fasting_session');
      }
    },
    async listMoodTags() {
      try {
        const rows = await database.getAllAsync<unknown>(
          `SELECT id, name, name_el AS nameEl, position, created_at AS createdAt,
             updated_at AS updatedAt FROM mood_tags ORDER BY position`,
        );
        return rows.map((row) => parseRecord(moodTagSchema, row, 'mood_tag'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'mood_tag');
      }
    },
    async listDayMoodTagIds(dayDate) {
      try {
        const rows = await database.getAllAsync<{ tag_id: string }>(
          'SELECT tag_id FROM diary_day_mood_tags WHERE day_date = ? ORDER BY tag_id',
          dayDate,
        );
        return rows.map(({ tag_id }) => tag_id);
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'mood_tag');
      }
    },
    async setDayMoodTags(dayDate, tagIds) {
      try {
        const now = clock.now();
        await database.withTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `INSERT INTO diary_days (date, mood, note, created_at, updated_at)
             VALUES (?, NULL, NULL, ?, ?) ON CONFLICT(date) DO NOTHING`,
            dayDate,
            now,
            now,
          );
          await transaction.runAsync('DELETE FROM diary_day_mood_tags WHERE day_date = ?', dayDate);
          for (const tagId of [...new Set(tagIds)]) {
            await transaction.runAsync(
              'INSERT INTO diary_day_mood_tags (day_date, tag_id, created_at) VALUES (?, ?, ?)',
              dayDate,
              tagId,
              now,
            );
          }
        });
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'mood_tag');
      }
    },
    async moodTagSummary(fromDay, toDay) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `SELECT mt.id AS tagId, mt.name, mt.name_el AS nameEl, COUNT(*) AS count
           FROM diary_day_mood_tags dmt JOIN mood_tags mt ON mt.id = dmt.tag_id
           WHERE dmt.day_date BETWEEN ? AND ?
           GROUP BY mt.id, mt.name, mt.name_el, mt.position
           ORDER BY count DESC, mt.position`,
          fromDay,
          toDay,
        );
        return rows.map((row) => parseRecord(moodTagAggregateSchema, row, 'mood_tag_aggregate'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'mood_tag');
      }
    },
  };
}
