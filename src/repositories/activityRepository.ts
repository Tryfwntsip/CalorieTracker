import type { Database } from '@/db/types';
import { exerciseLogSchema, stepsLogSchema } from '@/schemas';
import type { ExerciseLog, ExerciseLogWrite, StepsLog, StepsLogWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';

const selectExercise = `
SELECT id, day_date AS dayDate, activity_type AS activityType,
  duration_minutes AS durationMinutes, energy_kcal AS energyKcal, origin,
  external_uid AS externalUid, created_at AS createdAt, updated_at AS updatedAt
FROM exercise_logs
`;

const selectSteps = `
SELECT id, day_date AS dayDate, steps, origin, external_uid AS externalUid,
  created_at AS createdAt, updated_at AS updatedAt
FROM steps_logs
`;

export interface ActivityRepository {
  listExercises(dayDate: string): Promise<ExerciseLog[]>;
  createExercise(log: ExerciseLogWrite): Promise<ExerciseLog>;
  updateExercise(log: ExerciseLogWrite): Promise<ExerciseLog>;
  deleteExercise(id: string): Promise<void>;
  getSteps(dayDate: string): Promise<StepsLog | null>;
  upsertSteps(log: StepsLogWrite): Promise<StepsLog>;
  deleteSteps(id: string): Promise<void>;
}

export function createActivityRepository(
  database: Database,
  clock: Clock = systemClock,
): ActivityRepository {
  const getExercise = async (id: string): Promise<ExerciseLog | null> => {
    const row = await database.getFirstAsync<unknown>(`${selectExercise} WHERE id = ?`, id);
    return row === null ? null : parseRecord(exerciseLogSchema, row, 'exercise_log');
  };
  const getSteps = async (dayDate: string): Promise<StepsLog | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(
        `${selectSteps} WHERE day_date = ? AND origin = 'manual'`,
        dayDate,
      );
      return row === null ? null : parseRecord(stepsLogSchema, row, 'steps_log');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'steps_log');
    }
  };

  return {
    async listExercises(dayDate) {
      try {
        const rows = await database.getAllAsync<unknown>(
          `${selectExercise} WHERE day_date = ? ORDER BY created_at, id`,
          dayDate,
        );
        return rows.map((row) => parseRecord(exerciseLogSchema, row, 'exercise_log'));
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'exercise_log');
      }
    },
    async createExercise(log) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO exercise_logs (
            id, day_date, activity_type, duration_minutes, energy_kcal,
            origin, external_uid, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          log.id,
          log.dayDate,
          log.activityType,
          log.durationMinutes,
          log.energyKcal,
          log.origin,
          log.externalUid,
          now,
          now,
        );
        const created = await getExercise(log.id);
        if (!created) throw new Error('Inserted exercise was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'exercise_log');
      }
    },
    async updateExercise(log) {
      try {
        const result = await database.runAsync(
          `UPDATE exercise_logs SET day_date = ?, activity_type = ?,
            duration_minutes = ?, energy_kcal = ?, origin = ?, external_uid = ?,
            updated_at = ? WHERE id = ?`,
          log.dayDate,
          log.activityType,
          log.durationMinutes,
          log.energyKcal,
          log.origin,
          log.externalUid,
          clock.now(),
          log.id,
        );
        assertChanged(result.changes, 'exercise_log');
        const updated = await getExercise(log.id);
        if (!updated) throw new Error('Updated exercise was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'exercise_log');
      }
    },
    async deleteExercise(id) {
      try {
        const result = await database.runAsync('DELETE FROM exercise_logs WHERE id = ?', id);
        assertChanged(result.changes, 'exercise_log');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'exercise_log');
      }
    },
    getSteps,
    async upsertSteps(log) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO steps_logs (
            id, day_date, steps, origin, external_uid, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day_date, origin) DO UPDATE SET
            steps = excluded.steps, external_uid = excluded.external_uid,
            updated_at = excluded.updated_at`,
          log.id,
          log.dayDate,
          log.steps,
          log.origin,
          log.externalUid,
          now,
          now,
        );
        const saved = await getSteps(log.dayDate);
        if (!saved) throw new Error('Saved steps were not found.');
        return saved;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'steps_log');
      }
    },
    async deleteSteps(id) {
      try {
        const result = await database.runAsync('DELETE FROM steps_logs WHERE id = ?', id);
        assertChanged(result.changes, 'steps_log');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'steps_log');
      }
    },
  };
}
