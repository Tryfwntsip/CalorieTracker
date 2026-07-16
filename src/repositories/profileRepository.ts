import type { Database } from '@/db/types';
import { profileSchema } from '@/schemas';
import type { Profile, ProfileWrite } from '@/types';
import { assertChanged, mapRepositoryError, parseRecord } from '@/repositories/errors';
import { systemClock, type Clock } from '@/repositories/shared';

const selectProfile = `
SELECT id, date_of_birth AS dateOfBirth, sex, height_cm AS heightCm,
  current_weight_kg AS currentWeightKg, target_weight_kg AS targetWeightKg,
  activity_level AS activityLevel, goal_type AS goalType, weekly_rate_kg AS weeklyRateKg,
  calorie_target AS calorieTarget, protein_target_g AS proteinTargetG,
  carbs_target_g AS carbsTargetG, fat_target_g AS fatTargetG,
  created_at AS createdAt, updated_at AS updatedAt
FROM profile WHERE id = 1
`;

export interface ProfileRepository {
  get(): Promise<Profile | null>;
  create(profile: ProfileWrite): Promise<Profile>;
  update(profile: ProfileWrite): Promise<Profile>;
  delete(): Promise<void>;
}

export function createProfileRepository(
  database: Database,
  clock: Clock = systemClock,
): ProfileRepository {
  const get = async (): Promise<Profile | null> => {
    try {
      const row = await database.getFirstAsync<unknown>(selectProfile);
      return row === null ? null : parseRecord(profileSchema, row, 'profile');
    } catch (error: unknown) {
      throw mapRepositoryError(error, 'profile');
    }
  };

  const writeParams = (profile: ProfileWrite) =>
    [
      profile.dateOfBirth,
      profile.sex,
      profile.heightCm,
      profile.currentWeightKg,
      profile.targetWeightKg,
      profile.activityLevel,
      profile.goalType,
      profile.weeklyRateKg,
      profile.calorieTarget,
      profile.proteinTargetG,
      profile.carbsTargetG,
      profile.fatTargetG,
    ] as const;

  return {
    get,
    async create(profile) {
      try {
        const now = clock.now();
        await database.runAsync(
          `INSERT INTO profile (
            id, date_of_birth, sex, height_cm, current_weight_kg, target_weight_kg,
            activity_level, goal_type, weekly_rate_kg, calorie_target,
            protein_target_g, carbs_target_g, fat_target_g, created_at, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ...writeParams(profile),
          now,
          now,
        );
        const created = await get();
        if (!created) throw new Error('Inserted profile was not found.');
        return created;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'profile');
      }
    },
    async update(profile) {
      try {
        const result = await database.runAsync(
          `UPDATE profile SET
            date_of_birth = ?, sex = ?, height_cm = ?, current_weight_kg = ?,
            target_weight_kg = ?, activity_level = ?, goal_type = ?, weekly_rate_kg = ?,
            calorie_target = ?, protein_target_g = ?, carbs_target_g = ?, fat_target_g = ?,
            updated_at = ?
          WHERE id = 1`,
          ...writeParams(profile),
          clock.now(),
        );
        assertChanged(result.changes, 'profile');
        const updated = await get();
        if (!updated) throw new Error('Updated profile was not found.');
        return updated;
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'profile');
      }
    },
    async delete() {
      try {
        const result = await database.runAsync('DELETE FROM profile WHERE id = ?', 1);
        assertChanged(result.changes, 'profile');
      } catch (error: unknown) {
        throw mapRepositoryError(error, 'profile');
      }
    },
  };
}
