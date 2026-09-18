'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle, Clock, RefreshCw, UserX, XCircle } from 'lucide-react';
import { EmptyState, StatusBadge } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  cancelAppointmentAsStaff,
  completeAppointment,
  confirmAppointment,
  getOrganizationAppointments,
  markNoShow,
  type AppointmentStatus,
  type OrganizationAppointment,
} from '../lib/appointments';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CHECKED_IN: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  RESULT_PENDING: 'warning',
  RESULT_READY: 'info',
  RESULT_PUBLISHED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  RESCHEDULED: 'default',
  EXPIRED: 'default',
};

/** States from which the desk can still act. */
const OPEN_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

/**
 * Who is actually coming in, and what the desk can do about it.
 *
 * The appointments page could publish and block slots but never showed a single
 * booked appointment -- staff could see "3 of 5 booked" and had no way to learn
 * who the three were, confirm them, or record that one did not turn up. Every
 * action here goes through the server's own lifecycle rules: the buttons are
 * hidden where the state forbids the action, and the server refuses it anyway.
 */
export function AppointmentRoster({ organizationId }: { organizationId: string }) {
  const { t, formatDate, formatTime } = useTranslation();
  const [appointments, setAppointments] = useState<OrganizationAppointment[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setRefreshing(true);
    try {
      const data = await getOrganizationAppointments(organizationId, {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 100,
      });
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ops.common.loadFailed'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [organizationId, statusFilter, search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one lifecycle action and re-reads the list from the server. */
  const act = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ops.common.saveFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const started = (appointment: OrganizationAppointment) =>
    new Date(appointment.scheduledStart) <= new Date();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('ops.appointments.searchPlaceholder')}
          className="bc-solid min-w-[14rem] flex-1 rounded-lg px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as AppointmentStatus | '')}
          className="bc-solid rounded-lg px-3 py-2 text-sm text-donor-text"
        >
          <option value="">{t('filters.allStatuses')}</option>
          {(
            ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED'] as const
          ).map((status) => (
            <option key={status} value={status}>
              {t(`status.appointment.${status}`)}
            </option>
          ))}
        </select>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="bc-solid flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {t('actions.refresh')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/40 bg-donor-dangerMuted px-4 py-3 text-sm text-donor-onDangerMuted">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <CalendarDays className="animate-spin text-donor-primary" size={28} />
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          title={t('ops.appointments.noBookings')}
          description={t('ops.appointments.noBookingsHint')}
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment) => {
            const isOpen = OPEN_STATUSES.includes(appointment.status);
            const busy = busyId === appointment.id;
            const bloodGroup = appointment.donor.donorProfile?.bloodType
              ? `${appointment.donor.donorProfile.bloodType}${
                  appointment.donor.donorProfile.rhFactor === 'POSITIVE' ? '+' : '-'
                }`
              : null;

            return (
              <div key={appointment.id} className="bc-glass rounded-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-donor-text">
                        {appointment.donor.firstName} {appointment.donor.lastName}
                      </h3>
                      <StatusBadge variant={STATUS_VARIANT[appointment.status] ?? 'default'}>
                        {t(`status.appointment.${appointment.status}`)}
                      </StatusBadge>
                      {bloodGroup && <StatusBadge variant="info">{bloodGroup}</StatusBadge>}
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-donor-muted">
                      <Clock size={13} />
                      {formatDate(appointment.scheduledStart, 'medium')} ·{' '}
                      {formatTime(appointment.scheduledStart)} – {formatTime(appointment.scheduledEnd)}
                    </p>

                    <p className="mt-1 text-xs text-donor-muted">
                      {appointment.referenceNumber} ·{' '}
                      {t(`appointmentTypes.${appointment.appointmentType}`)}
                      {appointment.testType ? ` · ${appointment.testType.name}` : ''}
                    </p>

                    {appointment.notes && (
                      <p className="mt-2 text-sm text-donor-text">{appointment.notes}</p>
                    )}
                  </div>

                  {isOpen && (
                    <div className="flex flex-wrap items-center gap-2">
                      {appointment.status === 'PENDING' && (
                        <button
                          onClick={() =>
                            void act(appointment.id, () => confirmAppointment(appointment.id))
                          }
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg bg-donor-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          {t('ops.appointments.confirm')}
                        </button>
                      )}

                      {appointment.status === 'CONFIRMED' && (
                        <button
                          onClick={() =>
                            void act(appointment.id, () => completeAppointment(appointment.id))
                          }
                          disabled={busy}
                          className="bc-solid flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          {t('ops.appointments.complete')}
                        </button>
                      )}

                      {/* A no-show can only be recorded once the appointment
                          has actually started; the server enforces the same
                          rule, so this only keeps the button from lying. */}
                      {started(appointment) && (
                        <button
                          onClick={() =>
                            void act(appointment.id, () => markNoShow(appointment.id))
                          }
                          disabled={busy}
                          className="bc-solid flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-donor-onWarningMuted transition-colors hover:bg-donor-elevated disabled:opacity-50"
                        >
                          <UserX size={14} />
                          {t('ops.appointments.noShow')}
                        </button>
                      )}

                      {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && (
                        <button
                          onClick={() => {
                            const reason = window.prompt(t('ops.appointments.cancelReasonPrompt'));
                            if (reason === null) return;
                            void act(appointment.id, () =>
                              cancelAppointmentAsStaff(appointment.id, reason || undefined),
                            );
                          }}
                          disabled={busy}
                          className="bc-solid flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-donor-onDangerMuted transition-colors hover:bg-donor-elevated disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          {t('actions.cancel')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {appointment.cancellationReason && (
                  <p className="mt-3 border-t border-donor-border/50 pt-3 text-sm text-donor-muted">
                    {appointment.cancellationReason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
