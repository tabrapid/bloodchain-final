'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { listEmergencies, type Emergency } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { AlertTriangle } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function EmergenciesPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadEmergencies();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadEmergencies(page = 1) {
    try {
      const data = await listEmergencies({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setEmergencies(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load emergencies:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadEmergencies(1);
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.emergency.monitoring')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.emergency.monitoring')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-donor-text">{t('ops.emergency.monitoring')}</h1>
          <p className="text-sm text-donor-muted mt-1">{t('ops.emergency.monitoringHint')}</p>
        </div>

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40">
            <form onSubmit={handleSearch} className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('ops.common.allStatus')}</option>
                <option value="ACTIVE">{t('status.emergency.ACTIVE')}</option>
                <option value="MATCHING">{t('status.emergency.MATCHING')}</option>
                <option value="RESPONSES_RECEIVED">{t('status.emergency.RESPONSES_RECEIVED')}</option>
                <option value="DONOR_CONFIRMED">{t('status.emergency.DONOR_CONFIRMED')}</option>
                <option value="COMPLETED">{t('table.completedAt')}</option>
                <option value="EXPIRED">{t('status.emergency.EXPIRED')}</option>
                <option value="CANCELLED">{t('appointment.cancelledNotice')}</option>
              </select>
              <button
                type="submit"
                className="bg-donor-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-primary/85"
              >
                {t('actions.filter')}
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('home.bloodTypeLabel')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.units')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.hospital')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.emergency.responses')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.created')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.expires')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {emergencies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-donor-muted">
                      {t('ops.emergency.noneFound')}
                    </td>
                  </tr>
                ) : (
                  emergencies.map((emergency) => (
                    <tr key={emergency.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-donor-danger" />
                          <span className="font-medium text-donor-text">
                            {emergency.bloodType}{emergency.rhFactor}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={emergency.status} domain="emergency" />
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {emergency.unitsCollected}/{emergency.unitsRequired}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-donor-text">{emergency.hospital?.name}</p>
                        {emergency.hospital?.address && (
                          <p className="text-xs text-donor-muted">{emergency.hospital.address}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {emergency.responseCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(emergency.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {emergency.requiredBefore ? new Date(emergency.requiredBefore).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-donor-border/40 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadEmergencies(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => loadEmergencies(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
