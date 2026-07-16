import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import {
  completedFastingStreak,
  elapsedMinutes,
  fastingPresets,
  targetEndAt,
  type FastingKind,
} from '@/domain/fasting';
import { createId } from '@/lib/id';
import { createFastingRepository } from '@/repositories';
import {
  cancelFastingNotifications,
  scheduleFastingNotifications,
  type FastingNotificationCopy,
} from '@/services/notifications/fastingNotifications';
import type { FastingPlan, FastingSession } from '@/types';

type ReadyState = {
  plans: FastingPlan[];
  activePlan: FastingPlan | null;
  activeSession: FastingSession | null;
  sessions: FastingSession[];
  streak: number;
};
type State = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & ReadyState);

export type PlanDraft = {
  kind: FastingKind;
  name: string;
  fastingMinutes: number;
  eatingMinutes: number;
  startTime: string;
  fastingWeekdays: number[];
  reducedTargetPercent: number;
  notificationsEnabled: boolean;
};

export function useFastingData(now: Date) {
  const database = useDatabase();
  const repository = useMemo(() => createFastingRepository(database), [database]);
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const [plans, activePlan, activeSession, sessions] = await Promise.all([
        repository.listPlans(),
        repository.getActivePlan(),
        repository.getActiveSession(),
        repository.listSessions(),
      ]);
      setState({
        status: 'ready',
        plans,
        activePlan,
        activeSession,
        sessions,
        streak: completedFastingStreak(sessions, now.toISOString()),
      });
    } catch {
      setState({ status: 'error' });
    }
  }, [now, repository]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return {
    state,
    retry: load,
    async savePlan(draft: PlanDraft) {
      const preset = draft.kind === 'custom' ? null : fastingPresets[draft.kind];
      await repository.savePlan({
        id: createId(),
        kind: draft.kind,
        name: draft.name.trim(),
        fastingMinutes: preset?.fastingMinutes ?? draft.fastingMinutes,
        eatingMinutes: preset?.eatingMinutes ?? draft.eatingMinutes,
        startTime: draft.startTime,
        fastingWeekdays: draft.kind === '5_2' ? draft.fastingWeekdays : [],
        reducedTargetPercent: draft.reducedTargetPercent,
        notificationsEnabled: draft.notificationsEnabled,
        isActive: true,
      });
      await load();
    },
    async start(copy: FastingNotificationCopy, nowIso: string) {
      if (state.status !== 'ready' || !state.activePlan || state.activeSession) return;
      const startedAt = nowIso;
      const endAt = targetEndAt(startedAt, state.activePlan.fastingMinutes);
      const notificationIds = state.activePlan.notificationsEnabled
        ? await scheduleFastingNotifications(endAt, copy)
        : { startNotificationId: null, endNotificationId: null };
      await repository.createSession({
        id: createId(),
        planId: state.activePlan.id,
        startedAt,
        targetEndAt: endAt,
        endedAt: null,
        status: 'active',
        note: null,
        ...notificationIds,
      });
      await load();
    },
    async stop(note: string, nowIso: string) {
      if (state.status !== 'ready' || !state.activeSession) return;
      const session = state.activeSession;
      const endedAt = nowIso;
      await cancelFastingNotifications(session);
      await repository.updateSession({
        id: session.id,
        planId: session.planId,
        startedAt: session.startedAt,
        targetEndAt: session.targetEndAt,
        endedAt,
        status:
          elapsedMinutes(session.startedAt, endedAt) >=
          elapsedMinutes(session.startedAt, session.targetEndAt)
            ? 'completed'
            : 'cancelled',
        note: note.trim() || null,
        startNotificationId: null,
        endNotificationId: null,
      });
      await load();
    },
    async updateSession(session: FastingSession, startedAt: string, endedAt: string, note: string) {
      const start = new Date(startedAt).toISOString();
      const end = new Date(endedAt).toISOString();
      const targetMinutes = elapsedMinutes(session.startedAt, session.targetEndAt);
      const adjustedTargetEnd = targetEndAt(start, targetMinutes);
      await repository.updateSession({
        id: session.id,
        planId: session.planId,
        startedAt: start,
        targetEndAt: adjustedTargetEnd,
        endedAt: end,
        status: elapsedMinutes(start, end) >= targetMinutes ? 'completed' : 'cancelled',
        note: note.trim() || null,
        startNotificationId: null,
        endNotificationId: null,
      });
      await load();
    },
  };
}
