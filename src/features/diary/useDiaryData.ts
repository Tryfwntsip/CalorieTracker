import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { calculateDiaryTotals, effectiveCalorieTarget } from '@/domain/diary';
import { fastingAdjustedTarget } from '@/domain/fasting';
import { BLOCKED_CALORIE_TARGET } from '@/domain/goals/guardrails';
import { createId } from '@/lib/id';
import {
  createActivityRepository,
  createDiaryRepository,
  createFastingRepository,
  createHealthRecordRepository,
  createMealSectionRepository,
  createProfileRepository,
  createSettingsRepository,
} from '@/repositories';
import type {
  DiaryDay,
  DiaryEntry,
  DiaryEntryWrite,
  ExerciseLog,
  MealSection,
  Settings,
  StepsLog,
  WaterRecord,
  WeightRecord,
  MoodTag,
  FastingPlan,
} from '@/types';

type DiaryData = {
  day: DiaryDay | null;
  entries: DiaryEntry[];
  exercises: ExerciseLog[];
  sections: MealSection[];
  steps: StepsLog | null;
  water: WaterRecord[];
  weight: WeightRecord | null;
  settings: Settings;
  historicalTarget: number;
  moodTags: MoodTag[];
  selectedMoodTagIds: string[];
  activeFastingPlan: FastingPlan | null;
};

type State = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & DiaryData);

type UndoAction = { label: string; run: () => Promise<void> };

export type QuickEntryValues = {
  id?: string;
  section: string;
  label: string;
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type ExerciseValues = {
  id?: string;
  activityType: string;
  durationMinutes: number;
  energyKcal: number;
};

export function useDiaryData(dayDate: string, baseTarget: number) {
  const database = useDatabase();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const diary = useMemo(() => createDiaryRepository(database), [database]);
  const activity = useMemo(() => createActivityRepository(database), [database]);
  const health = useMemo(() => createHealthRecordRepository(database), [database]);
  const meals = useMemo(() => createMealSectionRepository(database), [database]);
  const settingsRepository = useMemo(() => createSettingsRepository(database), [database]);
  const profileRepository = useMemo(() => createProfileRepository(database), [database]);
  const fastingRepository = useMemo(() => createFastingRepository(database), [database]);

  const load = useCallback(async () => {
    try {
      const [
        day,
        entries,
        exercises,
        sections,
        steps,
        water,
        weight,
        settings,
        goalHistory,
        moodTags,
        selectedMoodTagIds,
        activeFastingPlan,
      ] = await Promise.all([
        diary.getDay(dayDate),
        diary.listEntries(dayDate),
        activity.listExercises(dayDate),
        meals.list(),
        activity.getSteps(dayDate),
        health.listWater(dayDate),
        health.getWeightForDay(dayDate),
        settingsRepository.get(),
        profileRepository.listGoalHistory(),
        fastingRepository.listMoodTags(),
        fastingRepository.listDayMoodTagIds(dayDate),
        fastingRepository.getActivePlan(),
      ]);
      if (!settings) throw new Error('Settings were not found.');
      const dayEnd = `${dayDate}T23:59:59.999Z`;
      const effectiveGoals = goalHistory.filter((goal) => goal.effectiveAt <= dayEnd);
      const historicalTarget =
        effectiveGoals.at(-1)?.calorieTarget ?? goalHistory[0]?.calorieTarget ?? baseTarget;
      setState({
        status: 'ready',
        day,
        entries,
        exercises,
        sections,
        steps,
        water,
        weight,
        settings,
        historicalTarget,
        moodTags,
        selectedMoodTagIds,
        activeFastingPlan,
      });
    } catch {
      setState({ status: 'error' });
    }
  }, [
    activity,
    baseTarget,
    dayDate,
    diary,
    fastingRepository,
    health,
    meals,
    profileRepository,
    settingsRepository,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const offerUndo = useCallback((action: UndoAction) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(action);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }, []);

  const runUndo = useCallback(async () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    await undo.run();
    await load();
  }, [load, undo]);

  const target = useMemo(() => {
    if (state.status !== 'ready') return baseTarget;
    return fastingAdjustedTarget(
      effectiveCalorieTarget(
        dayDate,
        state.historicalTarget,
        state.settings.weekdayCalorieOverrides,
      ),
      state.activeFastingPlan,
      dayDate,
    );
  }, [baseTarget, dayDate, state]);

  const totals = useMemo(
    () =>
      state.status === 'ready'
        ? calculateDiaryTotals(state.entries, state.exercises, target)
        : calculateDiaryTotals([], [], target),
    [state, target],
  );

  return {
    state,
    totals,
    undo,
    retry: load,
    runUndo,
    async saveEntry(values: QuickEntryValues) {
      const existing =
        values.id && state.status === 'ready'
          ? state.entries.find((entry) => entry.id === values.id)
          : undefined;
      const write: DiaryEntryWrite = {
        id: values.id ?? createId(),
        dayDate,
        section: values.section,
        foodId: null,
        customLabel: values.label.trim(),
        quantity: 1,
        unit: 'serving',
        gramsResolved: null,
        energyKcal: values.energyKcal,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        satFatG: existing?.satFatG ?? null,
        fiberG: existing?.fiberG ?? null,
        sugarG: existing?.sugarG ?? null,
        sodiumMg: existing?.sodiumMg ?? null,
        microsSnapshot: existing?.microsSnapshot ?? null,
        loggedVia: 'manual',
        deletedAt: null,
      };
      if (existing) await diary.updateEntry(write);
      else await diary.createEntry(write);
      await load();
    },
    async deleteEntry(id: string, undoLabel: string) {
      await diary.softDeleteEntry(id);
      offerUndo({ label: undoLabel, run: () => diary.restoreEntry(id).then(() => undefined) });
      await load();
    },
    async addWater(amountMl: number) {
      const now = new Date().toISOString();
      await health.createWater({
        id: createId(),
        dayDate,
        amountMl,
        loggedAt: now,
      });
      await load();
    },
    async deleteWater(record: WaterRecord, undoLabel: string) {
      await health.deleteWater(record.id);
      offerUndo({
        label: undoLabel,
        run: () =>
          health
            .createWater({
              id: record.id,
              dayDate: record.dayDate,
              amountMl: record.amountMl,
              loggedAt: record.loggedAt,
            })
            .then(() => undefined),
      });
      await load();
    },
    async saveWeight(weightKg: number) {
      if (state.status !== 'ready') return;
      const record = {
        id: state.weight?.id ?? createId(),
        dayDate,
        weightKg,
        origin: 'manual' as const,
        externalUid: null,
      };
      if (state.weight) await health.updateWeight(record);
      else await health.createWeight(record);
      await load();
    },
    async saveSteps(steps: number) {
      if (state.status !== 'ready') return;
      await activity.upsertSteps({
        id: state.steps?.id ?? createId(),
        dayDate,
        steps,
        origin: 'manual',
        externalUid: null,
      });
      await load();
    },
    async saveExercise(values: ExerciseValues) {
      if (state.status !== 'ready') return;
      const existing = values.id
        ? state.exercises.find((exercise) => exercise.id === values.id)
        : undefined;
      const write = {
        id: values.id ?? createId(),
        dayDate,
        activityType: values.activityType.trim(),
        durationMinutes: values.durationMinutes,
        energyKcal: values.energyKcal,
        origin: 'manual' as const,
        externalUid: null,
      };
      if (existing) await activity.updateExercise(write);
      else await activity.createExercise(write);
      await load();
    },
    async deleteExercise(record: ExerciseLog, undoLabel: string) {
      await activity.deleteExercise(record.id);
      offerUndo({
        label: undoLabel,
        run: () =>
          activity
            .createExercise({
              id: record.id,
              dayDate: record.dayDate,
              activityType: record.activityType,
              durationMinutes: record.durationMinutes,
              energyKcal: record.energyKcal,
              origin: record.origin,
              externalUid: record.externalUid,
            })
            .then(() => undefined),
      });
      await load();
    },
    async saveDay(mood: number | null, note: string | null, moodTagIds: readonly string[]) {
      await diary.saveDay({ date: dayDate, mood, note });
      await fastingRepository.setDayMoodTags(dayDate, moodTagIds);
      await load();
    },
    async copyFrom(sourceDate: string, section: string | null) {
      const source = await diary.listEntries(sourceDate);
      const selected = source.filter(
        (entry) => entry.deletedAt === null && (section === null || entry.section === section),
      );
      await diary.copyEntries(
        sourceDate,
        dayDate,
        section,
        selected.map(() => createId()),
      );
      await load();
      return selected.length;
    },
    async updateSection(section: MealSection) {
      await meals.update({
        id: section.id,
        name: section.name,
        nameEl: section.nameEl,
        position: section.position,
        isHidden: section.isHidden,
        isDefault: section.isDefault,
      });
      await load();
    },
    async addSection(name: string) {
      if (state.status !== 'ready') return;
      await meals.create({
        id: createId(),
        name: name.trim(),
        nameEl: null,
        position: state.sections.length,
        isHidden: false,
        isDefault: false,
      });
      await load();
    },
    async moveSection(id: string, direction: -1 | 1) {
      if (state.status !== 'ready') return;
      const ids = state.sections.map((section) => section.id);
      const index = ids.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next]!, ids[index]!];
      await meals.reorder(ids);
      await load();
    },
    async saveWeekdayOverride(value: number | null) {
      if (state.status !== 'ready') return;
      if (value !== null && value < BLOCKED_CALORIE_TARGET) {
        throw new Error('Weekday calorie target is below the safety floor.');
      }
      const weekday = String(new Date(`${dayDate}T00:00:00.000Z`).getUTCDay()) as keyof NonNullable<
        Settings['weekdayCalorieOverrides']
      >;
      const overrides = { ...(state.settings.weekdayCalorieOverrides ?? {}) };
      if (value === null) delete overrides[weekday];
      else overrides[weekday] = value;
      await settingsRepository.update({
        language: state.settings.language,
        theme: state.settings.theme,
        unitSystem: state.settings.unitSystem,
        waterGoalMl: state.settings.waterGoalMl,
        weekStartsOn: state.settings.weekStartsOn,
        diarySectionOrder: state.settings.diarySectionOrder,
        weekdayCalorieOverrides: Object.keys(overrides).length > 0 ? overrides : null,
      });
      await load();
    },
  };
}
