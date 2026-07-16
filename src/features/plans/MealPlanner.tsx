import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDayKey } from '@/domain/dates';
import { mondayOfWeek, shiftWeek, weekDays } from '@/domain/planning';
import { AppText, Button, Card, ErrorState, Input } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { useMealPlanner } from './useMealPlanner';

type SourceMode = 'recipe' | 'food' | 'template';
type Slot = { dayDate: string; section: string };
const sections = ['breakfast', 'lunch', 'dinner'] as const;

export function MealPlanner({ now }: { now: Date }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const initialWeek = useMemo(() => mondayOfWeek(now), [now]);
  const [weekStart, setWeekStart] = useState(initialWeek);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('recipe');
  const [foodQuery, setFoodQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const planner = useMealPlanner(weekStart);
  const days = weekDays(weekStart);

  if (planner.state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText color="secondary">{t('plans.planner.loading')}</AppText>
      </View>
    );
  }
  if (planner.state.status === 'error') {
    return (
      <ErrorState
        title={t('plans.planner.errorTitle')}
        body={t('plans.planner.errorBody')}
        onRetry={() => void planner.retry()}
      />
    );
  }

  const state = planner.state;
  const assign = (source: { recipeId?: string; foodId?: string; templateId?: string }) => {
    if (!slot) return;
    void planner.assign(slot.dayDate, slot.section, source).then(() => setSlot(null));
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.between}>
          <Button
            label={t('plans.planner.previous')}
            variant="secondary"
            onPress={() => setWeekStart((value) => shiftWeek(value, -1))}
          />
          <View style={styles.center}>
            <AppText variant="headline">{t('plans.planner.week')}</AppText>
            <AppText color="secondary">
              {formatDayKey(weekStart, i18n.language)} —{' '}
              {formatDayKey(days[6] ?? weekStart, i18n.language)}
            </AppText>
          </View>
          <Button
            label={t('plans.planner.next')}
            variant="secondary"
            onPress={() => setWeekStart((value) => shiftWeek(value, 1))}
          />
        </View>
        <View style={styles.row}>
          <Button
            label={t('plans.planner.copyWeek')}
            variant="secondary"
            onPress={() =>
              void planner.copyToNextWeek().then(() => setNotice(t('plans.planner.copied')))
            }
          />
          <Button
            label={t('plans.planner.grocery')}
            onPress={() =>
              void planner
                .generateGroceries(t('plans.planner.groceryName', { date: weekStart }))
                .then(() => setNotice(t('plans.planner.groceryCreated')))
            }
          />
        </View>
        {notice ? <AppText color="accent">{notice}</AppText> : null}
      </Card>

      {days.map((dayDate) => (
        <Card key={dayDate} style={styles.card}>
          <AppText variant="headline">{formatDayKey(dayDate, i18n.language)}</AppText>
          {sections.map((section) => {
            const entry = state.entries.find(
              (candidate) => candidate.dayDate === dayDate && candidate.section === section,
            );
            return (
              <View key={section} style={styles.slot}>
                <AppText variant="label" color="secondary">
                  {t(`diary.sections.${section}`)}
                </AppText>
                {entry ? (
                  <View style={styles.between}>
                    <AppText style={styles.flex}>
                      {i18n.language === 'el' ? (entry.labelEl ?? entry.label) : entry.label}
                    </AppText>
                    <Button
                      label={t('plans.planner.log')}
                      variant="secondary"
                      onPress={() =>
                        void planner.log(entry).then(() => setNotice(t('plans.planner.logged')))
                      }
                    />
                    <Button
                      label={t('common.delete')}
                      variant="ghost"
                      onPress={() => void planner.remove(entry)}
                    />
                  </View>
                ) : (
                  <Button
                    label={t('plans.planner.add')}
                    variant="ghost"
                    onPress={() => setSlot({ dayDate, section })}
                  />
                )}
              </View>
            );
          })}
        </Card>
      ))}

      {slot ? (
        <Card style={styles.card}>
          <View style={styles.between}>
            <AppText variant="headline">{t('plans.planner.choose')}</AppText>
            <Button label={t('common.close')} variant="ghost" onPress={() => setSlot(null)} />
          </View>
          <View style={styles.row}>
            {(['recipe', 'food', 'template'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: sourceMode === mode }}
                onPress={() => setSourceMode(mode)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: sourceMode === mode ? colors.primary : colors.surface,
                    borderColor: sourceMode === mode ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText color={sourceMode === mode ? 'onPrimary' : 'primary'}>
                  {t(`plans.planner.sources.${mode}`)}
                </AppText>
              </Pressable>
            ))}
          </View>
          {sourceMode === 'recipe'
            ? state.recipes.map((recipe) => (
                <Button
                  key={recipe.id}
                  label={i18n.language === 'el' ? (recipe.titleEl ?? recipe.title) : recipe.title}
                  variant="ghost"
                  onPress={() => assign({ recipeId: recipe.id })}
                />
              ))
            : null}
          {sourceMode === 'food' ? (
            <>
              <Input
                label={t('plans.planner.foodSearch')}
                value={foodQuery}
                onChangeText={setFoodQuery}
              />
              <Button
                label={t('plans.recipe.search')}
                variant="secondary"
                onPress={() => void planner.searchFoods(foodQuery)}
              />
              {state.foodResults.map((food) => (
                <Button
                  key={food.id}
                  label={i18n.language === 'el' ? (food.nameEl ?? food.name) : food.name}
                  variant="ghost"
                  onPress={() => assign({ foodId: food.id })}
                />
              ))}
            </>
          ) : null}
          {sourceMode === 'template'
            ? state.templates.map((template) => (
                <Button
                  key={template.id}
                  label={template.name}
                  variant="ghost"
                  onPress={() => assign({ templateId: template.id })}
                />
              ))
            : null}
          {sourceMode === 'template' && state.templates.length === 0 ? (
            <AppText color="secondary">{t('plans.planner.noTemplates')}</AppText>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  center: { alignItems: 'center', flex: 1 },
  slot: { gap: spacing.xs },
  flex: { flex: 1 },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
