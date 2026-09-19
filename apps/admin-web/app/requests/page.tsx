'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { listBloodRequests, type BloodRequest } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import {  } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function BloodRequestsPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadRequests();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadRequests(page = 1) {
    try {
      const data = await listBloodRequests({
        page,
        limit: 20,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setRequests(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load blood requests:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadRequests(1);
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.requests.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.requests.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-donor-text">{t('ops.requests.monitoring')}</h1>
          <p className="text-sm text-donor-muted mt-1">{t('ops.requests.monitoringHint')}</p>
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
                <option value="SUBMITTED">{t('status.request.SUBMITTED')}</option>
                <option value="UNDER_REVIEW">{t('home.verificationUnderReview')}</option>
                <option value="APPROVED">{t('ops.requests.approvedCount')}</option>
                <option value="PARTIALLY_APPROVED">{t('status.request.PARTIALLY_APPROVED')}</option>
                <option value="REJECTED">{t('status.request.REJECTED')}</option>
                <option value="CANCELLED">{t('appointment.cancelledNotice')}</option>
                <option value="READY_FOR_PICKUP">{t('status.request.READY_FOR_PICKUP')}</option>
                <option value="DELIVERED">{t('status.request.DELIVERED')}</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('ops.common.allPriority')}</option>
                <option value="ROUTINE">{t('status.priority.ROUTINE')}</option>
                <option value="URGENT">{t('status.priority.URGENT')}</option>
                <option value="CRITICAL">{t('medical.resultFlagsByCode.CRITICAL')}</option>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.requests.reference')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.priority')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.requests.requesting')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.requests.fulfilling')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.requests.items')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-donor-muted">
                      {t('ops.requests.noneFound')}
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <p className="font-medium text-donor-text">{request.requestReference}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={request.status} domain="request" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          request.priority === 'CRITICAL' ? 'bg-donor-dangerMuted text-donor-onDangerMuted' :
                          request.priority === 'URGENT' ? 'bg-donor-warningMuted text-donor-onWarningMuted' :
                          'bg-donor-elevated text-donor-text'
                        }`}>
                          {request.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {request.requestingOrganization?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {request.fulfillingOrganization?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {request.itemsCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(request.createdAt).toLocaleDateString()}
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
                  onClick={() => loadRequests(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => loadRequests(meta.page + 1)}
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
