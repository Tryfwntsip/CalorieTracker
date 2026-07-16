import type { Database } from '@/db/types';
import {
  ageOnDate,
  calculateTargets,
  evaluateGuardrails,
  minimumProteinTargetG,
  signedWeeklyRate,
  type GuardrailResult,
  type TargetCalculation,
} from '@/domain/goals';
import { createProfileRepository, RepositoryError } from '@/repositories';
import { profileCalculationInputSchema, profileSubmissionInputSchema } from '@/schemas';
import type { Profile, ProfileWrite } from '@/types';

export type ProfileSaveErrorCode =
  | 'invalid_input'
  | 'invalid_age'
  | 'protein_below_floor'
  | 'blocked'
  | 'confirmation_required'
  | 'storage';

export class ProfileSaveError extends Error {
  readonly code: ProfileSaveErrorCode;
  readonly guardrail?: GuardrailResult;
  readonly minimumProteinG?: number;

  constructor(
    code: ProfileSaveErrorCode,
    options?: {
      cause?: unknown;
      guardrail?: GuardrailResult;
      minimumProteinG?: number;
    },
  ) {
    super('The profile could not be saved.');
    this.name = 'ProfileSaveError';
    this.code = code;
    this.guardrail = options?.guardrail;
    this.minimumProteinG = options?.minimumProteinG;
    this.cause = options?.cause;
  }
}

export type PreparedProfileTargets = {
  age: number;
  signedWeeklyRateKg: number;
  calculation: TargetCalculation;
};

export function prepareProfileTargets(input: unknown, asOfDay: string): PreparedProfileTargets {
  const parsed = profileCalculationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProfileSaveError('invalid_input', { cause: parsed.error });
  }

  const age = ageOnDate(parsed.data.dateOfBirth, asOfDay);
  if (age < 18 || age > 120) {
    throw new ProfileSaveError('invalid_age');
  }

  const signedWeeklyRateKg = signedWeeklyRate(parsed.data.goalType, parsed.data.weeklyPaceKg);
  return {
    age,
    signedWeeklyRateKg,
    calculation: calculateTargets({
      age,
      sex: parsed.data.sex,
      heightCm: parsed.data.heightCm,
      currentWeightKg: parsed.data.currentWeightKg,
      activityLevel: parsed.data.activityLevel,
      goalType: parsed.data.goalType,
      weeklyRateKg: signedWeeklyRateKg,
    }),
  };
}

export async function saveProfile(
  database: Database,
  input: unknown,
  options: { asOfDay: string; confirmedAggressive: boolean },
): Promise<Profile> {
  const parsed = profileSubmissionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProfileSaveError('invalid_input', { cause: parsed.error });
  }

  const prepared = prepareProfileTargets(input, options.asOfDay);
  const minimumProteinG = minimumProteinTargetG(parsed.data.currentWeightKg);
  if (parsed.data.proteinTargetG < minimumProteinG) {
    throw new ProfileSaveError('protein_below_floor', { minimumProteinG });
  }

  const guardrail = evaluateGuardrails({
    calorieTarget: parsed.data.calorieTarget,
    currentWeightKg: parsed.data.currentWeightKg,
    targetWeightKg: parsed.data.targetWeightKg,
    heightCm: parsed.data.heightCm,
    goalType: parsed.data.goalType,
    weeklyRateKg: prepared.signedWeeklyRateKg,
  });
  if (guardrail.status === 'blocked') {
    throw new ProfileSaveError('blocked', { guardrail });
  }
  if (guardrail.status === 'confirmation_required' && !options.confirmedAggressive) {
    throw new ProfileSaveError('confirmation_required', { guardrail });
  }

  const profile: ProfileWrite = {
    dateOfBirth: parsed.data.dateOfBirth,
    sex: parsed.data.sex,
    heightCm: parsed.data.heightCm,
    currentWeightKg: parsed.data.currentWeightKg,
    targetWeightKg: parsed.data.targetWeightKg,
    activityLevel: parsed.data.activityLevel,
    goalType: parsed.data.goalType,
    weeklyRateKg: prepared.signedWeeklyRateKg,
    calorieTarget: parsed.data.calorieTarget,
    proteinTargetG: parsed.data.proteinTargetG,
    carbsTargetG: parsed.data.carbsTargetG,
    fatTargetG: parsed.data.fatTargetG,
  };

  const repository = createProfileRepository(database);
  try {
    return (await repository.get())
      ? await repository.update(profile)
      : await repository.create(profile);
  } catch (error: unknown) {
    if (error instanceof RepositoryError) {
      throw new ProfileSaveError('storage', { cause: error });
    }
    throw error;
  }
}
