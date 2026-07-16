import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  elapsedMinutes,
  fastingPresets,
  fastingProgress,
  type FastingKind,
} from '@/domain/fasting';
import type { FastingSession } from '@/types';
import { AppText, Button, Card, ErrorState, Input, ProgressRing } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH_TARGET, radii, spacing } from '@/ui/tokens';
import { useFastingData } from './useFastingData';

const kinds: FastingKind[] = ['12_12', '14_10', '16_8', '18_6', '20_4', '5_2', 'adf', 'custom'];

function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function FastingPanel({ now: initialNow }: { now: Date }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [clock, setClock] = useState(initialNow);
  const fasting = useFastingData(initialNow);
  const [editingPlan, setEditingPlan] = useState(false);
  const [kind, setKind] = useState<FastingKind>('16_8');
  const [customHours, setCustomHours] = useState('16');
  const [startTime, setStartTime] = useState('20:00');
  const [weekdays, setWeekdays] = useState<number[]>([1, 4]);
  const [notifications, setNotifications] = useState(false);
  const [note, setNote] = useState('');
  const [safety, setSafety] = useState(false);
  const [editingSession, setEditingSession] = useState<FastingSession | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const ready = fasting.state.status === 'ready' ? fasting.state : null;
  const progress = ready?.activeSession
    ? fastingProgress(ready.activeSession, clock.toISOString())
    : 0;
  const remaining = ready?.activeSession
    ? Math.max(0, elapsedMinutes(clock.toISOString(), ready.activeSession.targetEndAt))
    : 0;
  const customMinutes = Math.round(Number(customHours.replace(',', '.')) * 60);
  const planValid =
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
    (kind !== 'custom' ||
      (Number.isFinite(customMinutes) && customMinutes >= 60 && customMinutes <= 4320)) &&
    (kind !== '5_2' || weekdays.length === 2);
  const editDatesValid =
    Number.isFinite(new Date(editStart).getTime()) &&
    Number.isFinite(new Date(editEnd).getTime()) &&
    new Date(editEnd).getTime() >= new Date(editStart).getTime();

  const notificationCopy = useMemo(
    () => ({
      startedTitle: t('plans.fasting.notifications.startedTitle'),
      startedBody: t('plans.fasting.notifications.startedBody'),
      endedTitle: t('plans.fasting.notifications.endedTitle'),
      endedBody: t('plans.fasting.notifications.endedBody'),
    }),
    [t],
  );

  if (fasting.state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText color="secondary">{t('plans.fasting.loading')}</AppText>
      </View>
    );
  }
  if (fasting.state.status === 'error') {
    return (
      <ErrorState
        title={t('plans.fasting.errorTitle')}
        body={t('plans.fasting.errorBody')}
        onRetry={() => void fasting.retry()}
      />
    );
  }

  const state = fasting.state;

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.between}>
          <View style={styles.flex}>
            <AppText variant="headline">{t('plans.fasting.title')}</AppText>
            <AppText color="secondary">{t('plans.fasting.subtitle')}</AppText>
          </View>
          <Button
            label={t('plans.fasting.safety')}
            variant="ghost"
            onPress={() => setSafety((value) => !value)}
          />
        </View>
        {safety ? (
          <View style={[styles.safety, { backgroundColor: colors.warningSoft }]}>
            <AppText variant="bodyStrong" color="warning">
              {t('plans.fasting.safetyTitle')}
            </AppText>
            <AppText>{t('plans.fasting.safetyBody')}</AppText>
            <AppText>{t('plans.fasting.safetyStop')}</AppText>
          </View>
        ) : null}
      </Card>

      {state.activeSession ? (
        <Card style={[styles.card, styles.center]}>
          <ProgressRing
            progress={progress}
            accessibilityLabel={t('plans.fasting.progressA11y', {
              percent: Math.round(progress * 100),
            })}
          >
            <AppText variant="title">{Math.round(progress * 100)}%</AppText>
            <AppText variant="caption">{t('plans.fasting.fastingNow')}</AppText>
          </ProgressRing>
          <AppText variant="headline">
            {remaining > 0
              ? t('plans.fasting.remaining', { duration: durationLabel(remaining) })
              : t('plans.fasting.goalReached')}
          </AppText>
          <AppText color="secondary">
            {t('plans.fasting.ends', {
              time: new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(state.activeSession.targetEndAt)),
            })}
          </AppText>
          <Input label={t('plans.fasting.note')} value={note} onChangeText={setNote} multiline />
          <Button
            label={t('plans.fasting.stop')}
            variant="danger"
            fullWidth
            onPress={() =>
              void fasting.stop(note, clock.toISOString()).then(() => {
                setNote('');
                setNotice(t('plans.fasting.savedSession'));
              })
            }
          />
        </Card>
      ) : state.activePlan ? (
        <Card style={styles.card}>
          <AppText variant="headline">{state.activePlan.name}</AppText>
          <AppText color="secondary">
            {t('plans.fasting.planSummary', {
              fasting: durationLabel(state.activePlan.fastingMinutes),
              eating: durationLabel(state.activePlan.eatingMinutes),
            })}
          </AppText>
          <View style={styles.row}>
            <Button
              label={t('plans.fasting.start')}
              onPress={() => void fasting.start(notificationCopy, clock.toISOString())}
            />
            <Button
              label={t('plans.fasting.changePlan')}
              variant="secondary"
              onPress={() => setEditingPlan(true)}
            />
          </View>
        </Card>
      ) : (
        <Card style={styles.card}>
          <AppText>{t('plans.fasting.noPlan')}</AppText>
          <Button label={t('plans.fasting.choosePlan')} onPress={() => setEditingPlan(true)} />
        </Card>
      )}

      {notice ? (
        <Card>
          <AppText color="accent">{notice}</AppText>
        </Card>
      ) : null}

      {editingPlan ? (
        <Card style={styles.card}>
          <View style={styles.between}>
            <AppText variant="headline">{t('plans.fasting.choosePlan')}</AppText>
            <Button
              label={t('common.close')}
              variant="ghost"
              onPress={() => setEditingPlan(false)}
            />
          </View>
          <View style={styles.row}>
            {kinds.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }}
                onPress={() => {
                  setKind(option);
                  if (option === '5_2') setWeekdays([1, 4]);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: kind === option ? colors.primary : colors.surface,
                    borderColor: kind === option ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText color={kind === option ? 'onPrimary' : 'primary'}>
                  {t(`plans.fasting.kinds.${option}`)}
                </AppText>
              </Pressable>
            ))}
          </View>
          {kind === 'custom' ? (
            <Input
              label={t('plans.fasting.customHours')}
              value={customHours}
              onChangeText={setCustomHours}
              keyboardType="decimal-pad"
            />
          ) : null}
          {kind === '5_2' ? (
            <>
              <AppText variant="label">{t('plans.fasting.reducedDays')}</AppText>
              <View style={styles.row}>
                {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
                  <Pressable
                    key={weekday}
                    accessibilityRole="button"
                    accessibilityState={{ selected: weekdays.includes(weekday) }}
                    onPress={() =>
                      setWeekdays((current) =>
                        current.includes(weekday)
                          ? current.filter((value) => value !== weekday)
                          : current.length < 2
                            ? [...current, weekday]
                            : current,
                      )
                    }
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: weekdays.includes(weekday)
                          ? colors.primary
                          : colors.surface,
                      },
                    ]}
                  >
                    <AppText color={weekdays.includes(weekday) ? 'onPrimary' : 'primary'}>
                      {t(`plans.fasting.weekdays.${weekday}`)}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <AppText color="secondary">{t('plans.fasting.reducedTargetSafety')}</AppText>
            </>
          ) : null}
          <Input
            label={t('plans.fasting.startTime')}
            value={startTime}
            onChangeText={setStartTime}
          />
          <Button
            label={
              notifications
                ? t('plans.fasting.notifications.on')
                : t('plans.fasting.notifications.off')
            }
            variant="secondary"
            onPress={() => setNotifications((value) => !value)}
          />
          <AppText color="secondary">{t('plans.fasting.notifications.permissionHint')}</AppText>
          <Button
            label={t('common.save')}
            disabled={!planValid}
            fullWidth
            onPress={() =>
              void fasting
                .savePlan({
                  kind,
                  name: t(`plans.fasting.kinds.${kind}`),
                  fastingMinutes:
                    kind === 'custom' ? customMinutes : fastingPresets[kind].fastingMinutes,
                  eatingMinutes:
                    kind === 'custom'
                      ? Math.max(0, 1440 - customMinutes)
                      : fastingPresets[kind].eatingMinutes,
                  startTime,
                  fastingWeekdays: weekdays,
                  reducedTargetPercent: 75,
                  notificationsEnabled: notifications,
                })
                .then(() => {
                  setEditingPlan(false);
                  setNotice(t('plans.fasting.planSaved'));
                })
            }
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.between}>
          <AppText variant="headline">{t('plans.fasting.history')}</AppText>
          <AppText color="accent">{t('plans.fasting.streak', { count: state.streak })}</AppText>
        </View>
        {state.sessions.length === 0 ? (
          <AppText color="secondary">{t('plans.fasting.emptyHistory')}</AppText>
        ) : (
          state.sessions.map((session) => (
            <View key={session.id} style={styles.historyRow}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.startedAt))}
                </AppText>
                <AppText color="secondary">
                  {t(`plans.fasting.status.${session.status}`)}
                  {session.endedAt
                    ? ` · ${durationLabel(elapsedMinutes(session.startedAt, session.endedAt))}`
                    : ''}
                </AppText>
                {session.note ? <AppText>{session.note}</AppText> : null}
              </View>
              {session.endedAt ? (
                <Button
                  label={t('common.edit')}
                  variant="ghost"
                  onPress={() => {
                    setEditingSession(session);
                    setEditStart(toLocalInput(session.startedAt));
                    setEditEnd(toLocalInput(session.endedAt!));
                    setEditNote(session.note ?? '');
                  }}
                />
              ) : null}
            </View>
          ))
        )}
      </Card>

      {editingSession ? (
        <Card style={styles.card}>
          <AppText variant="headline">{t('plans.fasting.adjust')}</AppText>
          <Input
            label={t('plans.fasting.startedAt')}
            value={editStart}
            onChangeText={setEditStart}
          />
          <Input label={t('plans.fasting.endedAt')} value={editEnd} onChangeText={setEditEnd} />
          <Input label={t('plans.fasting.note')} value={editNote} onChangeText={setEditNote} />
          <View style={styles.row}>
            <Button
              label={t('common.save')}
              disabled={!editDatesValid}
              onPress={() =>
                void fasting
                  .updateSession(editingSession, editStart, editEnd, editNote)
                  .then(() => setEditingSession(null))
              }
            />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setEditingSession(null)}
            />
          </View>
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
  center: { alignItems: 'center' },
  flex: { flex: 1 },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayChip: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  safety: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
