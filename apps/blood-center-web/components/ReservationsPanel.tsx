'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Lock, RefreshCw, Unlock } from 'lucide-react';
import { DataTable, EmptyState, StatusBadge } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  getMovements,
  getReservations,
  releaseReservation,
  type InventoryMovement,
  type InventoryReservation,
} from '../lib/inventory';

const RESERVATION_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  ACTIVE: 'info',
  FULFILLED: 'success',
  RELEASED: 'default',
  EXPIRED: 'warning',
  CANCELLED: 'danger',
};

/**
 * The reservation ledger, and the movements behind it.
 *
 * `GET .../reservations` and `GET .../movements` have been in the API since
 * the inventory module shipped and no page read either, so a RESERVED unit in
 * the units table was a dead end: staff could see that something was held and
 * not who for, why, until when, or how to release it.
 */
export function ReservationsPanel({
  organizationId,
  onChanged,
}: {
  organizationId: string;
  onChanged?: () => void;
}) {
  const { t, formatDateTime } = useTranslation();
  const [view, setView] = useState<'reservations' | 'movements'>('reservations');
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      if (view === 'reservations') {
        const page = await getReservations(organizationId, {
          ...(statusFilter ? { status: statusFilter } : {}),
          limit: 50,
        });
        setReservations(page.data);
      } else {
        const page = await getMovements(organizationId, { limit: 50 });
        setMovements(page.data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ops.common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, view, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRelease = async (reservation: InventoryReservation) => {
    const reason = window.prompt(t('ops.inventory.releaseReasonPrompt'));
    if (reason === null) return;
    setBusyId(reservation.id);
    setError(null);
    try {
      await releaseReservation(organizationId, reservation.id, reason || undefined);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ops.common.saveFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const reservationColumns: DataTableColumn<InventoryReservation>[] = [
    {
      key: 'unit',
      header: t('ops.inventory.unitReference'),
      render: (row) => (
        <span className="font-mono text-xs">{row.bloodUnit?.unitReference ?? '—'}</span>
      ),
    },
    {
      key: 'bloodType',
      header: t('home.bloodTypeLabel'),
      render: (row) =>
        row.bloodUnit
          ? `${row.bloodUnit.bloodType}${row.bloodUnit.rhFactor === 'POSITIVE' ? '+' : '-'}`
          : '—',
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (row) => (
        <StatusBadge variant={RESERVATION_VARIANT[row.status] ?? 'default'}>
          {t(`status.reservation.${row.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'reservedFor',
      header: t('ops.inventory.reservedFor'),
      render: (row) => row.reservedForOrganization?.name ?? t('ops.inventory.ownUse'),
    },
    {
      key: 'reason',
      header: t('table.reason'),
      render: (row) => row.reason ?? '—',
    },
    {
      key: 'expiresAt',
      header: t('table.expires'),
      render: (row) => (row.expiresAt ? formatDateTime(row.expiresAt) : '—'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'ACTIVE' ? (
          <button
            onClick={() => void handleRelease(row)}
            disabled={busyId === row.id}
            className="bc-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
          >
            <Unlock size={13} />
            {t('ops.inventory.release')}
          </button>
        ) : null,
    },
  ];

  const movementColumns: DataTableColumn<InventoryMovement>[] = [
    {
      key: 'type',
      header: t('table.type'),
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <ArrowRightLeft size={13} className="text-donor-muted" />
          {t(`status.movement.${row.type}`)}
        </span>
      ),
    },
    {
      key: 'from',
      header: t('ops.inventory.from'),
      render: (row) => row.fromLocation?.name ?? '—',
    },
    {
      key: 'to',
      header: t('ops.inventory.to'),
      render: (row) => row.toLocation?.name ?? '—',
    },
    { key: 'reason', header: t('table.reason'), render: (row) => row.reason ?? '—' },
    {
      key: 'createdAt',
      header: t('table.date'),
      render: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {(['reservations', 'movements'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              aria-pressed={view === tab}
              className={
                view === tab
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-donor-primary px-3 py-1.5 text-xs font-semibold text-white'
                  : 'bc-solid inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-donor-muted transition-colors hover:text-donor-text'
              }
            >
              {tab === 'reservations' ? <Lock size={13} /> : <ArrowRightLeft size={13} />}
              {t(`ops.inventory.${tab}`)}
            </button>
          ))}
        </div>

        {view === 'reservations' && (
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bc-solid rounded-lg px-3 py-1.5 text-sm text-donor-text"
          >
            <option value="">{t('filters.allStatuses')}</option>
            {(['ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED', 'CANCELLED'] as const).map((status) => (
              <option key={status} value={status}>
                {t(`status.reservation.${status}`)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => void load()}
          className="bc-solid ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
        >
          <RefreshCw size={13} />
          {t('actions.refresh')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/40 bg-donor-dangerMuted px-4 py-3 text-sm text-donor-onDangerMuted">
          {error}
        </div>
      )}

      {view === 'reservations' ? (
        reservations.length === 0 && !isLoading ? (
          <EmptyState
            title={t('ops.inventory.noReservations')}
            description={t('ops.inventory.noReservationsHint')}
          />
        ) : (
          <DataTable
            columns={reservationColumns}
            rows={reservations}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            emptyMessage={t('ops.inventory.noReservations')}
          />
        )
      ) : (
        <DataTable
          columns={movementColumns}
          rows={movements}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage={t('ops.inventory.noMovements')}
        />
      )}
    </div>
  );
}
