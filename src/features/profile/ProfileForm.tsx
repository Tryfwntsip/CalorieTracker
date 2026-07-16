import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDatabase } from '@/db/DatabaseProvider';
import type { ActivityLevel, BiologicalSex, GoalType, GuardrailResult } from '@/domain/goals';
import { dayKeyOf } from '@/domain/dates';
import { asAppLanguage, persistLanguagePreference, type AppLanguage } from '@/lib/i18n';
import {
  profileBodyInputSchema,
  profileGoalInputSchema,
  profileTargetInputSchema,
} from '@/schemas';
import { prepareProfileTargets, ProfileSaveError, saveProfile } from '@/services/profile';
import type { Profile } from '@/types';
import { AppText, Button, Card, Input, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';

type FormState = {
  dateOfBirth: string;
  sex: BiologicalSex;
  heightCm: string;
  currentWeightKg: string;
  activityLevel: ActivityLevel;
  targetWeightKg: string;
  goalType: GoalType;
  weeklyPaceKg: string;
  calorieTarget: string;
  proteinTargetG: string;
  carbsTargetG: string;
  fatTargetG: string;
};

type Choice<T extends string | number> = {
  value: T;
  label: string;
};

type SafetyNotice = {
  kind: 'blocked' | 'confirmation';
  guardrail: GuardrailResult;
};

type Props = {
  mode: 'onboarding' | 'edit';
  initialProfile?: Profile;
  onSaved: (profile: Profile) => void;
  onCancel?: () => void;
  asOfDay?: string;
};

function initialForm(profile?: Profile): FormState {
  return {
    dateOfBirth: profile?.dateOfBirth ?? '',
    sex: profile?.sex ?? 'unspecified',
    heightCm: profile?.heightCm?.toString() ?? '',
    currentWeightKg: profile?.currentWeightKg?.toString() ?? '',
    activityLevel: (profile?.activityLevel as ActivityLevel | null) ?? 1,
    targetWeightKg: profile?.targetWeightKg?.toString() ?? '',
    goalType: profile?.goalType ?? 'maintain',
    weeklyPaceKg: Math.abs(profile?.weeklyRateKg ?? 0).toString(),
    calorieTarget: profile?.calorieTarget?.toString() ?? '',
    proteinTargetG: profile?.proteinTargetG?.toString() ?? '',
    carbsTargetG: profile?.carbsTargetG?.toString() ?? '',
    fatTargetG: profile?.fatTargetG?.toString() ?? '',
  };
}

function ChoiceGroup<T extends string | number>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label" color="secondary">
        {label}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={String(choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              onPress={() => onChange(choice.value)}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText variant="label" color={selected ? 'accent' : 'secondary'}>
                {choice.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileForm({ mode, initialProfile, onSaved, onCancel, asOfDay }: Props) {
  const database = useDatabase();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialForm(initialProfile));
  const [error, setError] = useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<SafetyNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const calculationDay = useMemo(() => asOfDay ?? dayKeyOf(new Date()), [asOfDay]);

  const sexChoices: Choice<BiologicalSex>[] = [
    { value: 'female', label: t('profile.form.sexFemale') },
    { value: 'male', label: t('profile.form.sexMale') },
    { value: 'unspecified', label: t('profile.form.sexUnspecified') },
  ];
  const activityChoices: Choice<ActivityLevel>[] = [1, 2, 3, 4, 5].map(
    (value) =>
      ({
        value,
        label: t(`profile.form.activity${value}`),
      }) as Choice<ActivityLevel>,
  );
  const goalChoices: Choice<GoalType>[] = [
    { value: 'lose', label: t('profile.form.goalLose') },
    { value: 'maintain', label: t('profile.form.goalMaintain') },
    { value: 'gain', label: t('profile.form.goalGain') },
    { value: 'build_muscle', label: t('profile.form.goalMuscle') },
  ];
  const language = asAppLanguage(i18n.language);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setSafetyNotice(null);
  };

  const changeLanguage = (value: AppLanguage) => {
    void i18n.changeLanguage(value);
    void persistLanguagePreference(value);
  };

  const nextFromBody = () => {
    if (!profileBodyInputSchema.safeParse(form).success) {
      setError(t('profile.form.invalidFields'));
      return;
    }
    setError(null);
    setStep(1);
  };

  const calculate = () => {
    if (!profileGoalInputSchema.safeParse(form).success) {
      setError(t('profile.form.invalidFields'));
      return;
    }
    try {
      const prepared = prepareProfileTargets(form, calculationDay);
      setForm((current) => ({
        ...current,
        calorieTarget: String(prepared.calculation.calorieTarget),
        proteinTargetG: String(prepared.calculation.proteinTargetG),
        carbsTargetG: String(prepared.calculation.carbsTargetG),
        fatTargetG: String(prepared.calculation.fatTargetG),
      }));
      setError(null);
      setStep(2);
    } catch (caught: unknown) {
      setError(
        caught instanceof ProfileSaveError && caught.code === 'invalid_age'
          ? t('profile.form.adultAge')
          : t('profile.form.invalidFields'),
      );
    }
  };

  const safetyMessages = (guardrail: GuardrailResult): string[] => [
    ...guardrail.blockedReasons.map((reason) => t(`profile.guardrails.${reason}`)),
    ...guardrail.confirmationReasons.map((reason) => t(`profile.guardrails.${reason}`)),
  ];

  const submit = async (confirmedAggressive: boolean) => {
    if (!profileTargetInputSchema.safeParse(form).success) {
      setError(t('profile.form.invalidTargets'));
      return;
    }
    setSaving(true);
    setError(null);
    setSafetyNotice(null);
    try {
      const saved = await saveProfile(database, form, {
        asOfDay: calculationDay,
        confirmedAggressive,
      });
      onSaved(saved);
    } catch (caught: unknown) {
      if (caught instanceof ProfileSaveError) {
        if (caught.code === 'blocked' && caught.guardrail) {
          setSafetyNotice({ kind: 'blocked', guardrail: caught.guardrail });
        } else if (caught.code === 'confirmation_required' && caught.guardrail) {
          setSafetyNotice({ kind: 'confirmation', guardrail: caught.guardrail });
        } else if (caught.code === 'protein_below_floor') {
          setError(
            t('profile.form.proteinFloor', {
              minimum: caught.minimumProteinG,
            }),
          );
        } else if (caught.code === 'invalid_age') {
          setError(t('profile.form.adultAge'));
        } else {
          setError(t('profile.form.saveError'));
        }
      } else {
        setError(t('profile.form.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.heading}>
        <AppText variant="title">
          {mode === 'onboarding' ? t('onboarding.title') : t('profile.editTitle')}
        </AppText>
        <AppText color="secondary">
          {mode === 'onboarding' ? t('onboarding.body') : t('profile.editBody')}
        </AppText>
        <AppText variant="caption" color="accent">
          {t('onboarding.step', { current: step + 1, total: 3 })}
        </AppText>
      </View>

      {step === 0 ? (
        <Card style={styles.card}>
          <AppText variant="headline">{t('profile.form.aboutYou')}</AppText>
          {mode === 'onboarding' ? (
            <ChoiceGroup
              label={t('profile.language.label')}
              value={language}
              choices={[
                { value: 'en', label: t('profile.language.en') },
                { value: 'el', label: t('profile.language.el') },
              ]}
              onChange={changeLanguage}
            />
          ) : null}
          <Input
            label={t('profile.form.dateOfBirth')}
            value={form.dateOfBirth}
            onChangeText={(value) => update('dateOfBirth', value)}
            placeholder={t('profile.form.datePlaceholder')}
            autoCapitalize="none"
          />
          <ChoiceGroup
            label={t('profile.form.sex')}
            value={form.sex}
            choices={sexChoices}
            onChange={(value) => update('sex', value)}
          />
          <Input
            label={t('profile.form.height')}
            value={form.heightCm}
            onChangeText={(value) => update('heightCm', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('profile.form.currentWeight')}
            value={form.currentWeightKg}
            onChangeText={(value) => update('currentWeightKg', value)}
            keyboardType="decimal-pad"
          />
          <ChoiceGroup
            label={t('profile.form.activity')}
            value={form.activityLevel}
            choices={activityChoices}
            onChange={(value) => update('activityLevel', value)}
          />
          <AppText variant="caption" color="secondary">
            {t('profile.form.metricOnly')}
          </AppText>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card style={styles.card}>
          <AppText variant="headline">{t('profile.form.yourGoal')}</AppText>
          <ChoiceGroup
            label={t('profile.form.goal')}
            value={form.goalType}
            choices={goalChoices}
            onChange={(value) => {
              update('goalType', value);
              if (value === 'maintain') update('weeklyPaceKg', '0');
            }}
          />
          <Input
            label={t('profile.form.targetWeight')}
            helper={t('profile.form.optional')}
            value={form.targetWeightKg}
            onChangeText={(value) => update('targetWeightKg', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('profile.form.weeklyPace')}
            helper={t('profile.form.weeklyPaceHelp')}
            value={form.weeklyPaceKg}
            onChangeText={(value) => update('weeklyPaceKg', value)}
            keyboardType="decimal-pad"
            editable={form.goalType !== 'maintain'}
          />
        </Card>
      ) : null}

      {step === 2 ? (
        <>
          <Card style={styles.card}>
            <AppText variant="headline">{t('profile.form.dailyTargets')}</AppText>
            <AppText color="secondary">{t('profile.form.targetHelp')}</AppText>
            <Input
              label={t('profile.form.calories')}
              value={form.calorieTarget}
              onChangeText={(value) => update('calorieTarget', value)}
              keyboardType="number-pad"
            />
            <Input
              label={t('profile.form.protein')}
              value={form.proteinTargetG}
              onChangeText={(value) => update('proteinTargetG', value)}
              keyboardType="number-pad"
            />
            <Input
              label={t('profile.form.carbs')}
              value={form.carbsTargetG}
              onChangeText={(value) => update('carbsTargetG', value)}
              keyboardType="number-pad"
            />
            <Input
              label={t('profile.form.fat')}
              value={form.fatTargetG}
              onChangeText={(value) => update('fatTargetG', value)}
              keyboardType="number-pad"
            />
          </Card>
          <Card style={styles.card}>
            <AppText variant="headline">{t('profile.form.beforeSave')}</AppText>
            <AppText color="secondary">{t('profile.about.disclaimer')}</AppText>
            <AppText variant="caption" color="secondary">
              {t('profile.form.extraSafety')}
            </AppText>
          </Card>
        </>
      ) : null}

      {error ? (
        <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]}>
          <AppText color="danger" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        </View>
      ) : null}

      {safetyNotice ? (
        <View
          style={[
            styles.notice,
            {
              backgroundColor:
                safetyNotice.kind === 'blocked' ? colors.dangerSoft : colors.warningSoft,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <AppText
            variant="bodyStrong"
            color={safetyNotice.kind === 'blocked' ? 'danger' : 'primary'}
          >
            {safetyNotice.kind === 'blocked'
              ? t('profile.guardrails.blockedTitle')
              : t('profile.guardrails.confirmTitle')}
          </AppText>
          {safetyMessages(safetyNotice.guardrail).map((message) => (
            <AppText key={message} color="secondary">
              • {message}
            </AppText>
          ))}
          {safetyNotice.kind === 'confirmation' ? (
            <Button
              label={t('profile.guardrails.confirmAction')}
              onPress={() => void submit(true)}
              loading={saving}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Button
            label={t('common.back')}
            onPress={() => {
              setError(null);
              setSafetyNotice(null);
              setStep((current) => current - 1);
            }}
            variant="secondary"
          />
        ) : mode === 'edit' && onCancel ? (
          <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" />
        ) : null}
        {step === 0 ? (
          <Button label={t('common.next')} onPress={nextFromBody} />
        ) : step === 1 ? (
          <Button label={t('profile.form.calculate')} onPress={calculate} />
        ) : (
          <Button
            label={mode === 'onboarding' ? t('onboarding.finish') : t('profile.form.saveChanges')}
            onPress={() => void submit(false)}
            loading={saving}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  card: { gap: spacing.md },
  field: { gap: spacing.xs },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  notice: {
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
