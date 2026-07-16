import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileForm } from '@/features/profile/ProfileForm';
import { useProfile } from '@/features/profile/ProfileProvider';
import { asAppLanguage, persistLanguagePreference, type AppLanguage } from '@/lib/i18n';
import { AppText, Button, Card, ErrorState } from '@/ui/components';
import { useTheme, type ThemePreference } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { Screen } from '@/ui/components/Screen';

type SegmentOption<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.surface }]}
          >
            <AppText variant="label" color={selected ? 'accent' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { profile, setProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const language = asAppLanguage(i18n.language);

  const changeLanguage = (lng: AppLanguage) => {
    void i18n.changeLanguage(lng);
    void persistLanguagePreference(lng);
  };

  const themeOptions: SegmentOption<ThemePreference>[] = [
    { value: 'system', label: t('profile.theme.system') },
    { value: 'light', label: t('profile.theme.light') },
    { value: 'dark', label: t('profile.theme.dark') },
  ];
  const languageOptions: SegmentOption<AppLanguage>[] = [
    { value: 'en', label: t('profile.language.en') },
    { value: 'el', label: t('profile.language.el') },
  ];

  if (!profile) {
    return (
      <Screen>
        <ErrorState title={t('profile.loadErrorTitle')} body={t('profile.loadErrorBody')} />
      </Screen>
    );
  }

  if (editing) {
    return (
      <ProfileForm
        mode="edit"
        initialProfile={profile}
        onSaved={(saved) => {
          setProfile(saved);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <View style={styles.profileHeading}>
          <View style={styles.headingText}>
            <AppText variant="headline">{t('profile.personalTitle')}</AppText>
            <AppText color="secondary">
              {t('profile.personalSummary', {
                calories: profile.calorieTarget,
                weight: profile.currentWeightKg,
              })}
            </AppText>
          </View>
          <Button
            label={t('profile.editAction')}
            onPress={() => setEditing(true)}
            variant="secondary"
          />
        </View>
        <View style={styles.targetGrid}>
          <View style={styles.target}>
            <AppText variant="caption" color="secondary">
              {t('profile.form.calories')}
            </AppText>
            <AppText variant="bodyStrong">
              {t('profile.targetCalories', { value: profile.calorieTarget })}
            </AppText>
          </View>
          <View style={styles.target}>
            <AppText variant="caption" color="secondary">
              {t('profile.form.protein')}
            </AppText>
            <AppText variant="bodyStrong">
              {t('profile.targetGrams', { value: profile.proteinTargetG })}
            </AppText>
          </View>
          <View style={styles.target}>
            <AppText variant="caption" color="secondary">
              {t('profile.form.carbs')}
            </AppText>
            <AppText variant="bodyStrong">
              {t('profile.targetGrams', { value: profile.carbsTargetG })}
            </AppText>
          </View>
          <View style={styles.target}>
            <AppText variant="caption" color="secondary">
              {t('profile.form.fat')}
            </AppText>
            <AppText variant="bodyStrong">
              {t('profile.targetGrams', { value: profile.fatTargetG })}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="headline">{t('profile.appearance')}</AppText>
        <View style={styles.setting}>
          <AppText variant="label" color="secondary">
            {t('profile.theme.label')}
          </AppText>
          <Segmented
            options={themeOptions}
            value={preference}
            onChange={setPreference}
            accessibilityLabel={t('profile.theme.label')}
          />
        </View>
        <View style={styles.setting}>
          <AppText variant="label" color="secondary">
            {t('profile.language.label')}
          </AppText>
          <Segmented
            options={languageOptions}
            value={language}
            onChange={changeLanguage}
            accessibilityLabel={t('profile.language.label')}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="headline">{t('profile.about.title')}</AppText>
        <AppText variant="body" color="secondary">
          {t('profile.about.disclaimer')}
        </AppText>
        <AppText variant="caption" color="disabled">
          {t('profile.about.version', { version: Constants.expoConfig?.version ?? '0.0.0' })}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  profileHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headingText: { flex: 1, gap: spacing.xxs },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  target: { minWidth: '45%', flexGrow: 1, gap: spacing.xxs },
  setting: { gap: spacing.xs },
  segmented: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: spacing.xxs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
