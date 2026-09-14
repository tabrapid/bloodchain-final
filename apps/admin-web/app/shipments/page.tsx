'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { listShipments, type Shipment } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import {  } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function ShipmentsPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadShipments();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadShipments(page = 1) {
    try {
      const data = await listShipments({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setShipments(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadShipments(1);
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.shipments.monitoring')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.shipments.monitoring')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">{t('ops.shipments.monitoringHint')}</p>
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
                <option value="CREATED">{t('table.created')}</option>
                <option value="COURIER_ASSIGNED">{t('status.shipment.COURIER_ASSIGNED')}</option>
                <option value="COURIER_ACCEPTED">{t('status.shipment.COURIER_ACCEPTED')}</option>
                <option value="PICKUP_STARTED">{t('status.shipment.PICKUP_STARTED')}</option>
                <option value="PICKED_UP">{t('status.shipment.PICKED_UP')}</option>
                <option value="IN_TRANSIT">{t('status.shipment.IN_TRANSIT')}</option>
                <option value="ARRIVED_AT_HOSPITAL">{t('status.shipment.ARRIVED_AT_HOSPITAL')}</option>
                <option value="DELIVERED">{t('status.shipment.DELIVERED')}</option>
                <option value="FAILED">{t('status.shipment.FAILED')}</option>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.requests.reference')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.shipments.source')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.shipments.destination')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.courier')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.units')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-donor-muted">
                      {t('ops.shipments.noneFound')}
                    </td>
                  </tr>
                ) : (
                  shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <p className="font-medium text-donor-text">{shipment.shipmentReference}</p>
                        {shipment.bloodRequest && (
                          <p className="text-xs text-donor-muted">{shipment.bloodRequest.priority}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={shipment.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {shipment.source?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {shipment.destination?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {shipment.courier?.displayName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {shipment.unitsCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(shipment.createdAt).toLocaleDateString()}
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
                  onClick={() => loadShipments(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => loadShipments(meta.page + 1)}
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
