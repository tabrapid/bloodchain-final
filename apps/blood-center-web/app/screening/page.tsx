'use client';

import { useEffect, useState } from 'react';
import { Activity, FlaskConical } from 'lucide-react';
import { useTranslation } from '@bloodchain/ui/i18n';

import { AppShell } from '../../components/AppShell';
import { MedicalReviewPanel } from '../../components/MedicalReviewPanel';
import { RecallPanel } from '../../components/RecallPanel';
import { ScreeningPanel } from '../../components/ScreeningPanel';
import { isAuthenticated, me, type MeResponse } from '../../lib/auth';

type Tab = 'screening' | 'review' | 'recalls';

/**
 * The blood-bank screening console.
 *
 * Three tabs for three different questions, kept apart because the answers do
 * not imply each other: what is waiting to be tested and reviewed, which donors
 * a result has put in front of a clinician, and which components a recall is
 * chasing. Folding any two of them together would invite exactly the inference
 * Sprint 10 forbids -- that a screening result is a decision about a donor, or
 * that a recall is a status on a component.
 */
export default function ScreeningPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('screening');

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setIsLoading(false);
        return;
      }
      try {
        const profile = await me();
        setUser(profile);
        setOrganizationId(profile.organizations[0]?.organizationId ?? '');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={t('ops.common.loadingEllipsis')}
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title={t('portal.authRequired')} subtitle={t('portal.bloodCenter.console')}>
        <div className="bc-glass flex flex-col items-center justify-center rounded-card p-12">
          <FlaskConical className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
        </div>
      </AppShell>
    );
  }

  const organization = user.organizations[0];

  return (
    <AppShell
      title={t('ops.screening.pageTitle')}
      subtitle={t('portal.bloodCenter.console')}
      organizationName={organization?.name}
      organizationType={organization?.type}
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-donor-border/60">
        {(['screening', 'review', 'recalls'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'border-b-2 border-donor-primary px-4 py-2.5 text-sm font-semibold text-donor-text'
                : 'border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-donor-muted transition-colors hover:text-donor-text'
            }
          >
            {key === 'screening'
              ? t('ops.screening.tab')
              : key === 'review'
                ? t('ops.medicalReview.tab')
                : t('ops.recall.tab')}
          </button>
        ))}
      </div>

      {tab === 'screening' ? (
        <ScreeningPanel
          organizationId={organizationId}
          currentUserName={`${user.firstName} ${user.lastName}`}
        />
      ) : tab === 'review' ? (
        <MedicalReviewPanel organizationId={organizationId} />
      ) : (
        <RecallPanel organizationId={organizationId} />
      )}
    </AppShell>
  );
}
