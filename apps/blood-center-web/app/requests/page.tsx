'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, Droplet, RefreshCw, Truck } from 'lucide-react';
import { RequestWorklist, StatCard } from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import { getBloodRequests, BloodRequest } from '../../lib/shipments';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Badge colour per status. The wording is not here on purpose: a label
 * written into a module-level map is fixed in one language, so the words
 * come from `t('status.request.<STATUS>')` at render instead.
 */
export default function BloodRequestsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const filters: { status?: string; type?: string } = { type: 'fulfilling' };
      if (statusFilter) filters.status = statusFilter;
      const data = await getBloodRequests(organizationId, filters);
      setRequests(data);
      setLoadFailed(false);
    } catch (err) {
      setLoadFailed(true);
      console.error('Failed to load blood requests:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, statusFilter]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const org = userData.organizations.find(
            (o) => o.type === 'BLOOD_CENTER' || o.type === 'BLOOD_CENTER_ADMIN',
          );
          if (org) {
            setOrganizationId(org.organizationId);
          } else if (userData.organizations.length > 0) {
            setOrganizationId(userData.organizations[0]?.organizationId || '');
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadRequests();
    }
  }, [organizationId, loadRequests]);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Droplet className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title={t('portal.authRequired')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
      >
        <div className="bc-auth-card flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Droplet className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">{t('ops.common.signInToRequests')}</p>
        </div>
      </AppShell>
    );
  }

  const pendingCount = requests.filter((r) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status),
  ).length;
  const readyCount = requests.filter((r) => r.status === 'READY_FOR_PICKUP').length;
  const inTransitCount = requests.filter((r) => r.status === 'IN_TRANSIT').length;
  const deliveredCount = requests.filter((r) =>
    ['DELIVERED', 'PARTIALLY_DELIVERED'].includes(r.status),
  ).length;

  return (
    <AppShell
      title={t('ops.requests.title')}
      subtitle={t('ops.dashboard.bloodCenterOperations')}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {t('ops.requests.incoming')}
            </h1>
            <p className="text-sm text-donor-muted">{t('ops.requests.pageSubtitleCenter')}</p>
          </div>
          <button
            onClick={loadRequests}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {t('actions.refresh')}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
          >
            <option value="">{t('filters.allStatuses')}</option>
            <option value="SUBMITTED">{t('status.request.SUBMITTED')}</option>
            <option value="UNDER_REVIEW">{t('home.verificationUnderReview')}</option>
            <option value="APPROVED">{t('ops.requests.approvedCount')}</option>
            <option value="PARTIALLY_APPROVED">{t('status.request.PARTIALLY_APPROVED')}</option>
            <option value="REJECTED">{t('status.request.REJECTED')}</option>
            <option value="READY_FOR_PICKUP">{t('status.request.READY_FOR_PICKUP')}</option>
            <option value="IN_TRANSIT">{t('status.request.IN_TRANSIT')}</option>
            <option value="DELIVERED">{t('status.request.DELIVERED')}</option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label={t('ops.requests.needsReview')}
          value={loadFailed || (refreshing && !requests.length) ? '—' : pendingCount.toString()}
          icon={Clock}
          variant={pendingCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label={t('status.request.READY_FOR_PICKUP')}
          value={loadFailed || (refreshing && !requests.length) ? '—' : readyCount.toString()}
          icon={CheckCircle}
          variant={readyCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label={t('status.request.IN_TRANSIT')}
          value={loadFailed || (refreshing && !requests.length) ? '—' : inTransitCount.toString()}
          icon={Truck}
          variant="info"
        />
        <StatCard
          label={t('status.request.DELIVERED')}
          value={loadFailed || (refreshing && !requests.length) ? '—' : deliveredCount.toString()}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      <RequestWorklist
        rows={requests}
        incoming={true}
        loading={refreshing}
        failed={loadFailed}
        onRetry={() => void loadRequests()}
      />
    </AppShell>
  );
}
