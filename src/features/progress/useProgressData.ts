import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { addDays } from '@/domain/dates';
import { analyzeProgress, type ProgressAnalysis } from '@/domain/progress';
import { createProgressRepository, createSettingsRepository } from '@/repositories';

export const progressRanges = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  twoYears: 730,
} as const;

export type ProgressRange = keyof typeof progressRanges;

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; analysis: ProgressAnalysis; fromDay: string; toDay: string };

export function useProgressData(toDay: string, range: ProgressRange) {
  const database = useDatabase();
  const [state, setState] = useState<State>({ status: 'loading' });
  const progress = useMemo(() => createProgressRepository(database), [database]);
  const settings = useMemo(() => createSettingsRepository(database), [database]);
  const fromDay = addDays(toDay, -(progressRanges[range] - 1));

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [snapshot, preferences] = await Promise.all([
        progress.load(fromDay, toDay),
        settings.get(),
      ]);
      if (!preferences) throw new Error('Settings were not found.');
      setState({
        status: 'ready',
        analysis: analyzeProgress(
          snapshot.nutrition,
          snapshot.weight,
          snapshot.water,
          snapshot.steps,
          preferences.weekdayCalorieOverrides,
        ),
        fromDay,
        toDay,
      });
    } catch {
      setState({ status: 'error' });
    }
  }, [fromDay, progress, settings, toDay]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { state, retry: load };
}
