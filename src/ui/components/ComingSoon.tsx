import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/ui/components/EmptyState';

/**
 * Honest placeholder for unbuilt areas (AGENTS.md rule 9: no fake UI).
 * Always states which milestone delivers the feature.
 */
export function ComingSoon({ milestone }: { milestone: number }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="construct-outline"
      title={t('comingSoon.title')}
      body={`${t('comingSoon.body')}\n${t('comingSoon.milestone', { milestone })}`}
    />
  );
}
