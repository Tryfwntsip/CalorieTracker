import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { addDays, dayKeyOf, formatDayKey, isDayKey } from '@/domain/dates';
import { BLOCKED_CALORIE_TARGET, CONFIRM_CALORIE_TARGET_MAX } from '@/domain/goals/guardrails';
import { BarcodeSheet } from '@/features/barcode/BarcodeSheet';
import { FoodSearchSheet } from '@/features/food/FoodSearchSheet';
import { useProfile } from '@/features/profile/ProfileProvider';
import type { DiaryEntry, ExerciseLog, MealSection, MoodTag, WaterRecord } from '@/types';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  Input,
  ProgressRing,
  Screen,
  Sheet,
  StatBar,
} from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { type ExerciseValues, type QuickEntryValues, useDiaryData } from './useDiaryData';

type SheetName =
  | 'foodSearch'
  | 'barcode'
  | 'entry'
  | 'exercise'
  | 'daily'
  | 'sections'
  | 'copy'
  | 'override'
  | null;

type Props = {
  mode: 'today' | 'diary';
};

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function rounded(value: number): string {
  return String(Math.round(value));
}

export function DiaryScreen({ mode }: Props) {
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => dayKeyOf(now), [now]);
  const [dayDate, setDayDate] = useState(today);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [entrySection, setEntrySection] = useState<string>('breakfast');
  const [editingExercise, setEditingExercise] = useState<ExerciseLog | null>(null);
  const { profile } = useProfile();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const diary = useDiaryData(dayDate, profile?.calorieTarget ?? 0);
  const refreshDiary = diary.retry;

  useFocusEffect(
    useCallback(() => {
      void refreshDiary();
    }, [refreshDiary]),
  );

  if (diary.state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText color="secondary">{t('diary.loading')}</AppText>
        </View>
      </Screen>
    );
  }

  if (diary.state.status === 'error') {
    return (
      <Screen>
        <ErrorState
          title={t('diary.loadErrorTitle')}
          body={t('diary.loadErrorBody')}
          onRetry={() => void diary.retry()}
        />
      </Screen>
    );
  }

  const state = diary.state;
  const activeEntries = state.entries.filter((entry) => entry.deletedAt === null);
  const visibleSections = state.sections.filter(
    (section) => !section.isHidden || activeEntries.some((entry) => entry.section === section.id),
  );
  const waterTotal = state.water.reduce((total, record) => total + record.amountMl, 0);
  const macroTargets = {
    protein: profile?.proteinTargetG ?? 0,
    carbs: profile?.carbsTargetG ?? 0,
    fat: profile?.fatTargetG ?? 0,
  };

  const openNewEntry = (section: string) => {
    setEditingEntry(null);
    setEntrySection(section);
    setSheet('entry');
  };

  const openFoodSearch = (section: string) => {
    setEntrySection(section);
    setSheet('foodSearch');
  };

  return (
    <Screen>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <AppText variant="title">
            {mode === 'today' ? t('today.title') : t('diary.title')}
          </AppText>
          <AppText color="secondary">{formatDayKey(dayDate, i18n.language)}</AppText>
        </View>
        {mode === 'diary' ? (
          <Button label={t('diary.today')} variant="ghost" onPress={() => setDayDate(today)} />
        ) : null}
      </View>

      {mode === 'diary' ? (
        <View style={styles.dateNavigation}>
          <Button
            label={t('diary.previousDay')}
            variant="secondary"
            onPress={() => setDayDate((date) => addDays(date, -1))}
          />
          <AppText variant="bodyStrong">{dayDate}</AppText>
          <Button
            label={t('diary.nextDay')}
            variant="secondary"
            onPress={() => setDayDate((date) => addDays(date, 1))}
          />
        </View>
      ) : null}

      <Card style={styles.summaryCard}>
        <ProgressRing
          progress={
            diary.totals.targetKcal > 0 ? diary.totals.consumedKcal / diary.totals.targetKcal : 0
          }
          size={148}
          accessibilityLabel={t('diary.energyProgress')}
        >
          <AppText variant="title">{rounded(diary.totals.remainingKcal)}</AppText>
          <AppText color="secondary">{t('diary.remaining')}</AppText>
        </ProgressRing>
        <View style={styles.energyGrid}>
          <EnergyValue label={t('diary.consumed')} value={diary.totals.consumedKcal} />
          <EnergyValue label={t('diary.burned')} value={diary.totals.burnedKcal} />
          <EnergyValue label={t('diary.target')} value={diary.totals.targetKcal} />
        </View>
      </Card>

      <Card style={styles.macroCard}>
        <StatBar
          label={t('diary.protein')}
          valueText={`${rounded(diary.totals.proteinG)} / ${macroTargets.protein} g`}
          progress={macroTargets.protein ? diary.totals.proteinG / macroTargets.protein : 0}
        />
        <StatBar
          label={t('diary.carbs')}
          valueText={`${rounded(diary.totals.carbsG)} / ${macroTargets.carbs} g`}
          progress={macroTargets.carbs ? diary.totals.carbsG / macroTargets.carbs : 0}
        />
        <StatBar
          label={t('diary.fat')}
          valueText={`${rounded(diary.totals.fatG)} / ${macroTargets.fat} g`}
          progress={macroTargets.fat ? diary.totals.fatG / macroTargets.fat : 0}
        />
      </Card>

      <View style={styles.quickActions}>
        <Button
          label={t('diary.addFood')}
          onPress={() => openFoodSearch(visibleSections[0]?.id ?? 'breakfast')}
        />
        <Button
          label={t('diary.scanBarcode')}
          variant="secondary"
          onPress={() => {
            setEntrySection(visibleSections[0]?.id ?? 'breakfast');
            setSheet('barcode');
          }}
        />
        <Button
          label={t('diary.manualQuickEntry')}
          variant="secondary"
          onPress={() => openNewEntry(visibleSections[0]?.id ?? 'breakfast')}
        />
        <Button label={t('diary.logDay')} variant="secondary" onPress={() => setSheet('daily')} />
        <Button
          label={t('diary.addExercise')}
          variant="secondary"
          onPress={() => {
            setEditingExercise(null);
            setSheet('exercise');
          }}
        />
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <View>
            <AppText variant="headline">{t('diary.dailyDetails')}</AppText>
            <AppText color="secondary">
              {t('diary.waterSummary', {
                amount: waterTotal,
                goal: state.settings.waterGoalMl,
              })}
            </AppText>
          </View>
          <Button label={t('common.edit')} variant="ghost" onPress={() => setSheet('daily')} />
        </View>
        <View style={styles.detailGrid}>
          <Detail label={t('diary.steps')} value={String(state.steps?.steps ?? 0)} />
          <Detail
            label={t('diary.weight')}
            value={state.weight ? `${state.weight.weightKg} kg` : t('diary.notLogged')}
          />
          <Detail
            label={t('diary.mood')}
            value={state.day?.mood ? `${state.day.mood} / 5` : t('diary.notLogged')}
          />
          <Detail
            label={t('diary.exercise')}
            value={t('diary.exerciseSummary', {
              minutes: state.exercises.reduce(
                (total, exercise) => total + exercise.durationMinutes,
                0,
              ),
              kcal: rounded(diary.totals.burnedKcal),
            })}
          />
        </View>
        {state.day?.note ? (
          <View style={styles.note}>
            <AppText variant="label" color="secondary">
              {t('diary.notes')}
            </AppText>
            <AppText>{state.day.note}</AppText>
          </View>
        ) : null}
      </Card>

      {state.exercises.length > 0 ? (
        <Card>
          <AppText variant="headline">{t('diary.exercise')}</AppText>
          {state.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.entryRow}>
              <Pressable
                style={styles.entryCopy}
                accessibilityRole="button"
                onPress={() => {
                  setEditingExercise(exercise);
                  setSheet('exercise');
                }}
              >
                <AppText variant="bodyStrong">{exercise.activityType}</AppText>
                <AppText color="secondary">
                  {t('diary.exerciseEntry', {
                    minutes: exercise.durationMinutes,
                    kcal: rounded(exercise.energyKcal),
                  })}
                </AppText>
              </Pressable>
              <Button
                label={t('common.delete')}
                variant="danger"
                onPress={() => void diary.deleteExercise(exercise, t('diary.exerciseDeleted'))}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {visibleSections.map((section) => {
        const sectionEntries = activeEntries.filter((entry) => entry.section === section.id);
        const sectionCalories = sectionEntries.reduce(
          (total, entry) => total + (entry.energyKcal ?? 0),
          0,
        );
        return (
          <Card key={section.id}>
            <View style={styles.cardHeader}>
              <View>
                <AppText variant="headline">
                  {i18n.language === 'el' ? (section.nameEl ?? section.name) : section.name}
                </AppText>
                <AppText color="secondary">
                  {t('diary.sectionCalories', { kcal: rounded(sectionCalories) })}
                </AppText>
              </View>
              <Button
                label={t('common.add')}
                variant="ghost"
                onPress={() => openFoodSearch(section.id)}
              />
            </View>
            {sectionEntries.length === 0 ? (
              <AppText color="secondary">{t('diary.emptyMeal')}</AppText>
            ) : (
              sectionEntries.map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <Pressable
                    style={styles.entryCopy}
                    accessibilityRole="button"
                    onPress={() => {
                      setEditingEntry(entry);
                      setEntrySection(entry.section);
                      setSheet('entry');
                    }}
                  >
                    <AppText variant="bodyStrong">
                      {entry.customLabel ??
                        (i18n.language === 'el'
                          ? (entry.foodNameEl ?? entry.foodName)
                          : entry.foodName) ??
                        t('diary.quickEntry')}
                    </AppText>
                    <AppText color="secondary">
                      {t('diary.entryCalories', {
                        kcal: rounded(entry.energyKcal ?? 0),
                      })}
                    </AppText>
                  </Pressable>
                  <Button
                    label={t('common.delete')}
                    variant="danger"
                    onPress={() => void diary.deleteEntry(entry.id, t('diary.entryDeleted'))}
                  />
                </View>
              ))
            )}
          </Card>
        );
      })}

      {mode === 'diary' ? (
        <View style={styles.manageActions}>
          <Button label={t('diary.copy')} variant="secondary" onPress={() => setSheet('copy')} />
          <Button
            label={t('diary.manageMeals')}
            variant="secondary"
            onPress={() => setSheet('sections')}
          />
          <Button
            label={t('diary.weekdayTarget')}
            variant="secondary"
            onPress={() => setSheet('override')}
          />
        </View>
      ) : null}

      {diary.undo ? (
        <Card style={[styles.undo, { backgroundColor: colors.surfaceAlt }]}>
          <AppText>{diary.undo.label}</AppText>
          <Button label={t('common.undo')} variant="ghost" onPress={() => void diary.runUndo()} />
        </Card>
      ) : null}

      <QuickEntrySheet
        visible={sheet === 'entry'}
        entry={editingEntry}
        section={entrySection}
        sections={state.sections.filter((section) => !section.isHidden)}
        onClose={() => setSheet(null)}
        onSave={async (values) => {
          await diary.saveEntry({
            ...values,
            label: values.label || t('diary.quickEntry'),
          });
          setSheet(null);
        }}
      />
      <FoodSearchSheet
        visible={sheet === 'foodSearch'}
        dayDate={dayDate}
        section={entrySection}
        onClose={() => setSheet(null)}
        onLogged={diary.retry}
      />
      {sheet === 'barcode' ? (
        <BarcodeSheet
          visible
          dayDate={dayDate}
          section={entrySection}
          onClose={() => setSheet(null)}
          onLogged={diary.retry}
        />
      ) : null}
      <ExerciseSheet
        visible={sheet === 'exercise'}
        exercise={editingExercise}
        onClose={() => setSheet(null)}
        onSave={async (values) => {
          await diary.saveExercise(values);
          setSheet(null);
        }}
      />
      <DailyDetailsSheet
        visible={sheet === 'daily'}
        day={state.day}
        moodTags={state.moodTags}
        selectedMoodTagIds={state.selectedMoodTagIds}
        water={state.water}
        steps={state.steps?.steps ?? null}
        weight={state.weight?.weightKg ?? null}
        onClose={() => setSheet(null)}
        onAddWater={(amount) => diary.addWater(amount)}
        onDeleteWater={(record) => diary.deleteWater(record, t('diary.waterDeleted'))}
        onSave={async (values) => {
          if (values.weight !== null) await diary.saveWeight(values.weight);
          if (values.steps !== null) await diary.saveSteps(values.steps);
          await diary.saveDay(values.mood, values.note, values.moodTagIds);
          setSheet(null);
        }}
      />
      <SectionManagerSheet
        visible={sheet === 'sections'}
        sections={state.sections}
        onClose={() => setSheet(null)}
        onUpdate={diary.updateSection}
        onAdd={diary.addSection}
        onMove={diary.moveSection}
      />
      <CopySheet
        visible={sheet === 'copy'}
        sections={state.sections}
        onClose={() => setSheet(null)}
        onCopy={async (source, section) => {
          await diary.copyFrom(source, section);
          setSheet(null);
        }}
      />
      <TargetOverrideSheet
        visible={sheet === 'override'}
        target={diary.totals.targetKcal}
        baseTarget={profile?.calorieTarget ?? 0}
        onClose={() => setSheet(null)}
        onSave={async (value) => {
          await diary.saveWeekdayOverride(value);
          setSheet(null);
        }}
      />
    </Screen>
  );
}

function EnergyValue({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.energyValue}>
      <AppText variant="headline">{rounded(value)}</AppText>
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function QuickEntrySheet({
  visible,
  entry,
  section,
  sections,
  onClose,
  onSave,
}: {
  visible: boolean;
  entry: DiaryEntry | null;
  section: string;
  sections: MealSection[];
  onClose: () => void;
  onSave: (values: QuickEntryValues) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [label, setLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [selectedSection, setSelectedSection] = useState(section);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLabel(entry?.customLabel ?? '');
    setCalories(
      entry?.energyKcal === null || entry?.energyKcal === undefined ? '' : String(entry.energyKcal),
    );
    setProtein(
      entry?.proteinG === null || entry?.proteinG === undefined ? '' : String(entry.proteinG),
    );
    setCarbs(entry?.carbsG === null || entry?.carbsG === undefined ? '' : String(entry.carbsG));
    setFat(entry?.fatG === null || entry?.fatG === undefined ? '' : String(entry.fatG));
    setSelectedSection(entry?.section ?? section);
    setError(null);
  }, [entry, section]);

  useEffectWhenVisible(visible, reset);

  const save = async () => {
    const energyKcal = numberOrNull(calories);
    if (energyKcal === null) {
      setError(t('diary.form.invalidCalories'));
      return;
    }
    await onSave({
      id: entry?.id,
      section: selectedSection,
      label: label.trim(),
      energyKcal,
      proteinG: numberOrNull(protein),
      carbsG: numberOrNull(carbs),
      fatG: numberOrNull(fat),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.form.foodTitle')}>
      <Input label={t('diary.form.label')} value={label} onChangeText={setLabel} />
      <View style={styles.sectionPicker}>
        {sections.map((item) => (
          <Choice
            key={item.id}
            label={i18n.language === 'el' ? (item.nameEl ?? item.name) : item.name}
            selected={selectedSection === item.id}
            onPress={() => setSelectedSection(item.id)}
          />
        ))}
      </View>
      <Input
        label={t('diary.form.calories')}
        value={calories}
        onChangeText={setCalories}
        keyboardType="decimal-pad"
      />
      <View style={styles.formGrid}>
        <View style={styles.formField}>
          <Input
            label={t('diary.protein')}
            value={protein}
            onChangeText={setProtein}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Input
            label={t('diary.carbs')}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Input
            label={t('diary.fat')}
            value={fat}
            onChangeText={setFat}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      {error ? <AppText color="danger">{error}</AppText> : null}
      <Button label={t('common.save')} fullWidth onPress={() => void save()} />
    </Sheet>
  );
}

function ExerciseSheet({
  visible,
  exercise,
  onClose,
  onSave,
}: {
  visible: boolean;
  exercise: ExerciseLog | null;
  onClose: () => void;
  onSave: (values: ExerciseValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [activityType, setActivityType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [calories, setCalories] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    setActivityType(exercise?.activityType ?? '');
    setMinutes(exercise ? String(exercise.durationMinutes) : '');
    setCalories(exercise ? String(exercise.energyKcal) : '');
    setError(null);
  }, [exercise]);
  useEffectWhenVisible(visible, reset);

  const save = async () => {
    const durationMinutes = numberOrNull(minutes);
    const energyKcal = numberOrNull(calories);
    if (
      !activityType.trim() ||
      durationMinutes === null ||
      energyKcal === null ||
      (durationMinutes === 0 && energyKcal === 0)
    ) {
      setError(t('diary.form.invalidExercise'));
      return;
    }
    await onSave({
      id: exercise?.id,
      activityType,
      durationMinutes: Math.round(durationMinutes),
      energyKcal,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.form.exerciseTitle')}>
      <Input label={t('diary.form.activity')} value={activityType} onChangeText={setActivityType} />
      <Input
        label={t('diary.form.minutes')}
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
      />
      <Input
        label={t('diary.form.burnedCalories')}
        value={calories}
        onChangeText={setCalories}
        keyboardType="decimal-pad"
      />
      {error ? <AppText color="danger">{error}</AppText> : null}
      <Button label={t('common.save')} fullWidth onPress={() => void save()} />
    </Sheet>
  );
}

function DailyDetailsSheet({
  visible,
  day,
  moodTags,
  selectedMoodTagIds,
  water,
  steps,
  weight,
  onClose,
  onAddWater,
  onDeleteWater,
  onSave,
}: {
  visible: boolean;
  day: { mood: number | null; note: string | null } | null;
  moodTags: MoodTag[];
  selectedMoodTagIds: string[];
  water: WaterRecord[];
  steps: number | null;
  weight: number | null;
  onClose: () => void;
  onAddWater: (amount: number) => Promise<void>;
  onDeleteWater: (record: WaterRecord) => Promise<void>;
  onSave: (values: {
    mood: number | null;
    note: string | null;
    steps: number | null;
    weight: number | null;
    moodTagIds: string[];
  }) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [stepValue, setStepValue] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [moodTagIds, setMoodTagIds] = useState<string[]>([]);
  const reset = useCallback(() => {
    setMood(day?.mood ?? null);
    setNote(day?.note ?? '');
    setStepValue(steps === null ? '' : String(steps));
    setWeightValue(weight === null ? '' : String(weight));
    setMoodTagIds(selectedMoodTagIds);
  }, [day, selectedMoodTagIds, steps, weight]);
  useEffectWhenVisible(visible, reset);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.form.dayTitle')}>
      <AppText variant="label" color="secondary">
        {t('diary.water')}
      </AppText>
      <View style={styles.quickActions}>
        <Button
          label={t('diary.addWater250')}
          variant="secondary"
          onPress={() => void onAddWater(250)}
        />
        <Button
          label={t('diary.addWater500')}
          variant="secondary"
          onPress={() => void onAddWater(500)}
        />
      </View>
      {water.map((record) => (
        <View key={record.id} style={styles.entryRow}>
          <AppText style={styles.entryCopy}>{record.amountMl} ml</AppText>
          <Button
            label={t('common.delete')}
            variant="danger"
            onPress={() => void onDeleteWater(record)}
          />
        </View>
      ))}
      <Input
        label={t('diary.steps')}
        value={stepValue}
        onChangeText={setStepValue}
        keyboardType="number-pad"
      />
      <Input
        label={t('diary.form.weightKg')}
        value={weightValue}
        onChangeText={setWeightValue}
        keyboardType="decimal-pad"
      />
      <AppText variant="label" color="secondary">
        {t('diary.mood')}
      </AppText>
      <View style={styles.sectionPicker}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Choice
            key={value}
            label={String(value)}
            selected={mood === value}
            onPress={() => setMood(value)}
          />
        ))}
      </View>
      <AppText variant="label" color="secondary">
        {t('diary.moodTags')}
      </AppText>
      <View style={styles.sectionPicker}>
        {moodTags.map((tag) => (
          <Choice
            key={tag.id}
            label={i18n.language === 'el' ? tag.nameEl : tag.name}
            selected={moodTagIds.includes(tag.id)}
            onPress={() =>
              setMoodTagIds((current) =>
                current.includes(tag.id)
                  ? current.filter((id) => id !== tag.id)
                  : [...current, tag.id],
              )
            }
          />
        ))}
      </View>
      <Input label={t('diary.notes')} value={note} onChangeText={setNote} multiline />
      <Button
        label={t('common.save')}
        fullWidth
        onPress={() =>
          void onSave({
            mood,
            note: note.trim() || null,
            steps: numberOrNull(stepValue),
            weight: numberOrNull(weightValue),
            moodTagIds,
          })
        }
      />
    </Sheet>
  );
}

function SectionManagerSheet({
  visible,
  sections,
  onClose,
  onUpdate,
  onAdd,
  onMove,
}: {
  visible: boolean;
  sections: MealSection[];
  onClose: () => void;
  onUpdate: (section: MealSection) => Promise<void>;
  onAdd: (name: string) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.sections.title')}>
      <ScrollView style={styles.sheetScroll}>
        <View style={styles.sheetContent}>
          {sections.map((section, index) => (
            <SectionManagerRow
              key={`${section.id}-${section.name}`}
              section={section}
              index={index}
              count={sections.length}
              onUpdate={onUpdate}
              onMove={onMove}
            />
          ))}
          <Input label={t('diary.sections.newName')} value={newName} onChangeText={setNewName} />
          <Button
            label={t('diary.sections.add')}
            disabled={!newName.trim()}
            onPress={() => {
              void onAdd(newName);
              setNewName('');
            }}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

function SectionManagerRow({
  section,
  index,
  count,
  onUpdate,
  onMove,
}: {
  section: MealSection;
  index: number;
  count: number;
  onUpdate: (section: MealSection) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const shownName = i18n.language === 'el' ? (section.nameEl ?? section.name) : section.name;
  const [name, setName] = useState(shownName);
  return (
    <View style={styles.sectionManager}>
      <Input label={t('diary.sections.name')} value={name} onChangeText={setName} />
      <View style={styles.sectionManageRow}>
        <Button
          label={t('common.save')}
          variant="ghost"
          disabled={!name.trim() || name.trim() === shownName}
          onPress={() =>
            void onUpdate(
              i18n.language === 'el'
                ? { ...section, nameEl: name.trim() }
                : { ...section, name: name.trim() },
            )
          }
        />
        <Button
          label={section.isHidden ? t('diary.sections.show') : t('diary.sections.hide')}
          variant="ghost"
          onPress={() => void onUpdate({ ...section, isHidden: !section.isHidden })}
        />
        <Button
          label={t('common.moveUp')}
          variant="ghost"
          disabled={index === 0}
          onPress={() => void onMove(section.id, -1)}
        />
        <Button
          label={t('common.moveDown')}
          variant="ghost"
          disabled={index === count - 1}
          onPress={() => void onMove(section.id, 1)}
        />
      </View>
    </View>
  );
}

function CopySheet({
  visible,
  sections,
  onClose,
  onCopy,
}: {
  visible: boolean;
  sections: MealSection[];
  onClose: () => void;
  onCopy: (sourceDate: string, section: string | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [section, setSection] = useState<string | null>(null);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.copyTitle')}>
      <Input
        label={t('diary.copyDate')}
        value={source}
        onChangeText={setSource}
        placeholder={t('diary.datePlaceholder')}
      />
      <View style={styles.sectionPicker}>
        <Choice
          label={t('diary.wholeDay')}
          selected={section === null}
          onPress={() => setSection(null)}
        />
        {sections
          .filter((item) => !item.isHidden)
          .map((item) => (
            <Choice
              key={item.id}
              label={item.name}
              selected={section === item.id}
              onPress={() => setSection(item.id)}
            />
          ))}
      </View>
      <Button
        label={t('diary.copyAction')}
        fullWidth
        disabled={!isDayKey(source)}
        onPress={() => void onCopy(source, section)}
      />
    </Sheet>
  );
}

function TargetOverrideSheet({
  visible,
  target,
  baseTarget,
  onClose,
  onSave,
}: {
  visible: boolean;
  target: number;
  baseTarget: number;
  onClose: () => void;
  onSave: (value: number | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(target));
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    setValue(String(target));
    setConfirmationRequired(false);
    setError(null);
  }, [target]);
  useEffectWhenVisible(visible, reset);
  const parsed = numberOrNull(value);
  const save = () => {
    if (parsed === null || parsed < BLOCKED_CALORIE_TARGET) {
      setError(t('diary.overrideTooLow', { minimum: BLOCKED_CALORIE_TARGET }));
      return;
    }
    if (parsed <= CONFIRM_CALORIE_TARGET_MAX && !confirmationRequired) {
      setConfirmationRequired(true);
      setError(null);
      return;
    }
    void onSave(Math.round(parsed));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('diary.targetOverrideTitle')}>
      <AppText color="secondary">{t('diary.targetOverrideBody', { base: baseTarget })}</AppText>
      <Input
        label={t('diary.form.calories')}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
      />
      {confirmationRequired ? (
        <AppText color="warning">{t('diary.overrideConfirm')}</AppText>
      ) : null}
      {error ? <AppText color="danger">{error}</AppText> : null}
      <View style={styles.quickActions}>
        <Button
          label={confirmationRequired ? t('diary.confirmOverride') : t('common.save')}
          disabled={parsed === null}
          onPress={save}
        />
        <Button
          label={t('diary.useBaseTarget')}
          variant="ghost"
          onPress={() => void onSave(null)}
        />
      </View>
    </Sheet>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <AppText variant="label" color={selected ? 'accent' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function useEffectWhenVisible(visible: boolean, effect: () => void) {
  useEffect(() => {
    if (visible) effect();
  }, [effect, visible]);
}

const styles = StyleSheet.create({
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleCopy: { flex: 1, gap: spacing.xs },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: spacing.lg,
  },
  energyGrid: { gap: spacing.md, flex: 1 },
  energyValue: { alignItems: 'center' },
  macroCard: { gap: spacing.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  detail: { width: '46%', gap: spacing.xs },
  note: { marginTop: spacing.md, gap: spacing.xs },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  entryCopy: { flex: 1, gap: spacing.xs, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  manageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  undo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  formGrid: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1 },
  sectionManageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionManager: { gap: spacing.xs },
  sheetScroll: { maxHeight: 430 },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.sm },
});
