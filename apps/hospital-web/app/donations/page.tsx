'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Droplet, RefreshCw, Search } from 'lucide-react';
import {
  ConfirmDialog,
  DataTable,
  DataTableColumn,
  Modal,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { isAuthenticated, me, MeResponse } from '../../lib/auth';
import {
  abortDonation,
  checkInDonor,
  completeDonation,
  Donation,
  DonationAppointment,
  getDonations,
  getTodayAppointments,
  recordAssessment,
  startCollection,
} from '../../lib/donations';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * The console screen a donor's booking actually arrives on.
 *
 * The donation workflow existed end to end in the API and nowhere in either
 * console: a donor could book a slot from the phone, and no member of staff had
 * a screen on which to receive them, approve them, or record what was drawn.
 * This is that screen -- one row per appointment, one button for whatever step
 * comes next, and a completion dialog that captures the volume the donor's own
 * history will show.
 */

/**
 * Badge colour per status; the wording comes from
 * `t('status.appointment.<STATUS>')` at render, because a label written into
 * a module-level map can only ever be in one language.
 */
const appointmentStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  CHECKED_IN: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

/**
 * Badge colour per status; the wording comes from
 * `t('status.donation.<STATUS>')` at render, because a label written into
 * a module-level map can only ever be in one language.
 */
const donationStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  SCHEDULED: 'info',
  CHECKED_IN: 'info',
  ASSESSED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  DEFERRED: 'warning',
  CANCELLED: 'danger',
  ABORTED: 'danger',
};

/**
 * The badge key is the donation status, except when a checked-in donor already
 * has an assessment on file: then what matters is the clinical decision, and
 * that wording lives under `medical` so a clinician reviews it in one place.
 */
function donationStatusKey(key: string): string {
  if (key === 'ASSESSED') return 'medical.assessment.APPROVED_FOR_DONATION';
  if (key === 'DEFERRED') return 'medical.assessment.DEFERRED';
  return `status.donation.${key}`;
}

const DEFAULT_VOLUME_ML = 450;

function fullName(donor?: { firstName: string; lastName: string }) {
  return donor ? `${donor.firstName} ${donor.lastName}` : '—';
}

export default function DonationsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<DonationAppointment[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [completing, setCompleting] = useState<Donation | null>(null);
  // Deferring a donor and aborting a collection both take a reason the file
  // keeps. `prompt()` could not show which donor, and an empty answer looked
  // the same as pressing Escape.
  const [deferring, setDeferring] = useState<Donation | null>(null);
  const [aborting, setAborting] = useState<Donation | null>(null);
  const [volumeMl, setVolumeMl] = useState(String(DEFAULT_VOLUME_ML));
  const [staffNotes, setStaffNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingData(true);
    try {
      const [today, recent] = await Promise.all([
        getTodayAppointments(organizationId),
        getDonations(organizationId, { search: searchQuery || undefined }),
      ]);
      setAppointments(today);
      setDonations(recent);
      setError(null);
    } catch (err: unknown) {
      // An empty table reads as "nobody booked today", which is a very
      // different thing from "the server did not answer".
      setError(err instanceof Error ? err.message : t('ops.donations.loadFailed'));
    } finally {
      setIsLoadingData(false);
    }
  }, [organizationId, searchQuery]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const org = userData.organizations[0];
          if (org) setOrganizationId(org.organizationId);
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
    if (organizationId) loadData();
  }, [organizationId, loadData]);

  const act = async (key: string, fn: () => Promise<unknown>, failure: string) => {
    setActionLoading(key);
    try {
      await fn();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * The donation behind an appointment.
   *
   * Today's-appointments embeds a summary ({ id, status }) the moment check-in
   * creates the record, while the donations list carries the full row including
   * the volume. Prefer the full row, keyed by its appointment, and fall back to
   * the summary so the next action appears immediately after check-in rather
   * than only once the list refetches.
   */
  const donationFor = (appointment: DonationAppointment): Donation | null => {
    const full = donations.find((d) => d.appointment?.id === appointment.id);
    if (full) return full;
    const summary = appointment.donation;
    if (!summary) return null;
    return {
      id: summary.id,
      donationReference: summary.donationReference,
      donationType: 'WHOLE_BLOOD',
      status: summary.status,
      donor: appointment.donor,
      appointment: { id: appointment.id, referenceNumber: appointment.referenceNumber },
      assessment: null,
    };
  };

  const openCompletion = (donation: Donation) => {
    setCompleting(donation);
    setVolumeMl(String(donation.volumeMl ?? DEFAULT_VOLUME_ML));
    setStaffNotes('');
  };

  const submitCompletion = async () => {
    if (!completing) return;
    const volume = Number(volumeMl);
    if (!Number.isFinite(volume) || volume <= 0) {
      setError('Enter the volume collected, in millilitres.');
      return;
    }
    const now = new Date();
    const started = completing.collectionStartedAt
      ? new Date(completing.collectionStartedAt)
      : new Date(now.getTime() - 10 * 60_000);
    await act(
      completing.id,
      () =>
        completeDonation(organizationId, completing.id, {
          volumeMl: volume,
          bloodType: completing.bloodType ?? completing.donor?.bloodType ?? undefined,
          rhFactor: completing.rhFactor ?? completing.donor?.rhFactor ?? undefined,
          collectionStartedAt: started.toISOString(),
          collectionCompletedAt: now.toISOString(),
          notes: staffNotes || undefined,
        }),
      'Failed to complete the donation',
    );
    setCompleting(null);
  };

  const appointmentActions = (appointment: DonationAppointment) => {
    const donation = donationFor(appointment);
    const busy = actionLoading === appointment.id || actionLoading === donation?.id;
    const buttons: { label: string; onClick: () => void; variant?: 'primary' | 'danger' }[] = [];

    if (!donation && ['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      buttons.push({
        label: t('actions.checkIn'),
        variant: 'primary',
        onClick: () =>
          act(appointment.id, () => checkInDonor(organizationId, appointment.id), 'Failed to check the donor in'),
      });
    }
    // The API keeps an approved donor on CHECKED_IN -- there is no separate
    // "assessed" status -- and refuses to start collection once a non-approving
    // assessment exists. So the assessment record, not the status, decides
    // whether this row offers screening or collection.
    if (donation?.status === 'CHECKED_IN') {
      if (!donation.assessment) {
        buttons.push({
          label: t('actions.approve'),
          variant: 'primary',
          onClick: () =>
            act(
              donation.id,
              () => recordAssessment(organizationId, donation.id, { decision: 'APPROVED_FOR_DONATION' }),
              'Failed to record the assessment',
            ),
        });
        buttons.push({
          label: t('ops.donations.defer'),
          variant: 'danger',
          onClick: () => setDeferring(donation),
        });
      } else if (donation.assessment.decision === 'APPROVED_FOR_DONATION') {
        buttons.push({
          label: t('ops.donations.startCollection'),
          variant: 'primary',
          onClick: () =>
            act(donation.id, () => startCollection(organizationId, donation.id), 'Failed to start collection'),
        });
      }
    }
    if (donation?.status === 'IN_PROGRESS') {
      buttons.push({ label: t('education.complete'), variant: 'primary', onClick: () => openCompletion(donation) });
      buttons.push({
        label: t('ops.donations.abort'),
        variant: 'danger',
        onClick: () => setAborting(donation),
      });
    }

    return { buttons, busy };
  };

  const appointmentColumns: DataTableColumn<DonationAppointment>[] = [
    {
      key: 'referenceNumber',
      header: t('ops.requests.reference'),
      render: (a) => <span className="font-mono">{a.referenceNumber}</span>,
    },
    {
      key: 'donor',
      header: t('table.donor'),
      render: (a) => (
        <div>
          <div className="text-donor-text">{fullName(a.donor)}</div>
          <div className="text-xs text-donor-muted">{a.donor?.email}</div>
        </div>
      ),
    },
    {
      key: 'scheduledStart',
      header: t('table.time'),
      render: (a) =>
        new Date(a.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'status',
      header: t('ops.common.stage'),
      render: (a) => {
        const donation = donationFor(a);
        if (!donation) {
          return (
            <StatusBadge variant={appointmentStatusVariant[a.status] ?? 'default'}>
              {t(`status.appointment.${a.status}`)}
            </StatusBadge>
          );
        }
        const key =
          donation.status === 'CHECKED_IN' && donation.assessment?.decision === 'APPROVED_FOR_DONATION'
            ? 'ASSESSED'
            : donation.status === 'CHECKED_IN' && donation.assessment
              ? 'DEFERRED'
              : donation.status;
        return (
          <StatusBadge variant={donationStatusVariant[key] ?? 'default'}>
            {t(donationStatusKey(key))}
          </StatusBadge>
        );
      },
    },
    {
      key: 'volume',
      header: t('table.volume'),
      render: (a) => {
        const donation = donationFor(a);
        return donation?.volumeMl ? `${donation.volumeMl} mL` : <span className="text-donor-muted">—</span>;
      },
    },
    {
      key: 'actions',
      header: t('ops.common.nextStep'),
      className: 'text-right',
      render: (a) => {
        const { buttons, busy } = appointmentActions(a);
        if (!buttons.length) return <span className="text-xs text-donor-muted">{t('ops.donations.noActionNeeded')}</span>;
        return (
          <div className="flex items-center justify-end gap-2">
            {buttons.map((button) => (
              <button
                key={button.label}
                onClick={button.onClick}
                disabled={busy}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  button.variant === 'primary'
                    ? 'bg-donor-primary text-white hover:bg-donor-primary/80'
                    : button.variant === 'danger'
                      ? 'border border-donor-danger/50 text-donor-danger hover:bg-donor-dangerMuted'
                      : 'border border-donor-border text-donor-text hover:bg-donor-elevated'
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  const donationColumns: DataTableColumn<Donation>[] = [
    {
      key: 'donationReference',
      header: t('ops.requests.reference'),
      render: (d) => <span className="font-mono">{d.donationReference}</span>,
    },
    { key: 'donor', header: t('table.donor'), render: (d) => fullName(d.donor) },
    {
      key: 'bloodType',
      header: t('ops.common.group'),
      render: (d) =>
        d.bloodType ? `${d.bloodType}${d.rhFactor === 'POSITIVE' ? '+' : d.rhFactor === 'NEGATIVE' ? '−' : ''}` : '—',
    },
    { key: 'volumeMl', header: t('table.volume'), render: (d) => (d.volumeMl ? `${d.volumeMl} mL` : '—') },
    {
      key: 'status',
      header: t('table.status'),
      render: (d) => {
        return (
          <StatusBadge variant={donationStatusVariant[d.status] ?? 'default'}>
            {t(donationStatusKey(d.status))}
          </StatusBadge>
        );
      },
    },
    {
      key: 'completedAt',
      header: t('table.completedAt'),
      render: (d) => {
        const at = d.completedAt ?? d.collectionCompletedAt;
        return at ? new Date(at).toLocaleString() : '—';
      },
    },
  ];

  const waiting = appointments.filter((a) => ['PENDING', 'CONFIRMED'].includes(a.status)).length;
  const inProgress = donations.filter((d) => ['CHECKED_IN', 'ASSESSED', 'IN_PROGRESS'].includes(d.status)).length;
  const isToday = (d: Donation) => {
    const at = d.completedAt ?? d.collectionCompletedAt;
    return d.status === 'COMPLETED' && !!at && new Date(at).toDateString() === new Date().toDateString();
  };
  const completedToday = donations.filter(isToday).length;
  const volumeToday = donations.filter(isToday).reduce((sum, d) => sum + (d.volumeMl ?? 0), 0);

  if (isLoading) {
    return (
      <AppShell title={t('ops.common.loadingEllipsis')} subtitle={t('portal.hospital.console')}>
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title={t('ops.common.signInRequired')} subtitle={t('portal.hospital.console')}>
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Droplet className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">{t('ops.common.signInRequired')}</h2>
          <p className="text-center text-donor-muted">{t('ops.donations.signInHint')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('ops.donations.title')}
      subtitle={t('portal.hospital.console')}
      userName={`${user.firstName} ${user.lastName}`}
      organizationName={user.organizations[0]?.name}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-donor-text">{t('ops.donations.title')}</h1>
        <p className="text-sm text-donor-muted">
          {t('ops.donations.receiveHint')}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-donor-onDangerMuted">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            {t('actions.dismiss')}
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label={t('ops.donations.waitingCheckIn')} value={String(waiting)} variant={waiting > 0 ? 'warning' : 'default'} />
        <StatCard label={t('gamification.inProgress')} value={String(inProgress)} variant={inProgress > 0 ? 'info' : 'default'} />
        <StatCard label={t('ops.donations.completedToday')} value={String(completedToday)} variant="success" />
        <StatCard label={t('ops.donations.collectedToday')} value={`${volumeToday} mL`} variant="success" />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={16} />
          <input
            type="text"
            placeholder={t('ops.donations.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bc-solid py-2 pl-10 pr-4 text-sm text-donor-text placeholder:text-donor-muted"
          />
        </div>
        <button
          onClick={loadData}
          disabled={isLoadingData}
          className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
        >
          <RefreshCw size={14} />
          {t('actions.refresh')}
        </button>
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-donor-text">{t('ops.donations.todaysAppointments')}</h2>
      <div className="mb-8">
        <DataTable
          columns={appointmentColumns}
          rows={appointments}
          keyExtractor={(a) => a.id}
          loading={isLoadingData}
          emptyMessage={t('ops.donations.noneToday')}
        />
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-donor-text">{t('ops.donations.recent')}</h2>
      <DataTable
        columns={donationColumns}
        rows={donations}
        keyExtractor={(d) => d.id}
        loading={isLoadingData}
        emptyMessage={t('ops.donations.noneRecorded')}
      />

      <Modal
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title={t('ops.donations.complete')}
      >
        {completing && (
          <div className="space-y-4">
            <p className="text-sm text-donor-muted">
              {fullName(completing.donor)} — {completing.donationReference}
            </p>
            <div>
              <label htmlFor="volume-ml" className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.donations.volumeCollected')}
              </label>
              <input
                id="volume-ml"
                type="number"
                min={1}
                value={volumeMl}
                onChange={(e) => setVolumeMl(e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              />
              <p className="mt-1 text-xs text-donor-muted">
                {t('ops.inventory.donorFacingVolume')}
              </p>
            </div>
            <div>
              <label htmlFor="staff-notes" className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.common.notesOptional')}
              </label>
              <input
                id="staff-notes"
                type="text"
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder={t('ops.donations.vitalsPlaceholder')}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={submitCompletion}
                disabled={actionLoading === completing.id}
                className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
              >
                {actionLoading === completing.id ? t('common.saving') : t('ops.donations.saveDonation')}
              </button>
              <button
                onClick={() => setCompleting(null)}
                className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
              >
                {t('actions.cancel')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deferring !== null}
        onClose={() => setDeferring(null)}
        onConfirm={(notes) => {
          const donation = deferring;
          if (!donation) return;
          setDeferring(null);
          act(
            donation.id,
            () => recordAssessment(organizationId, donation.id, { decision: 'DEFERRED', notes }),
            t('ops.common.saveFailed'),
          );
        }}
        tone="danger"
        title={t('ops.donations.deferTitle')}
        body={t('ops.donations.deferBody')}
        context={deferring ? fullName(deferring.donor) : null}
        reason={{ required: true, label: t('ops.donations.deferReason') }}
        confirmLabel={t('ops.donations.defer')}
        loading={actionLoading === deferring?.id}
      />

      <ConfirmDialog
        open={aborting !== null}
        onClose={() => setAborting(null)}
        onConfirm={(reason) => {
          const donation = aborting;
          if (!donation) return;
          setAborting(null);
          act(
            donation.id,
            () => abortDonation(organizationId, donation.id, { reason }),
            t('ops.common.saveFailed'),
          );
        }}
        tone="danger"
        title={t('ops.donations.abortTitle')}
        body={t('ops.donations.abortBody')}
        context={aborting ? fullName(aborting.donor) : null}
        reason={{ required: true, label: t('ops.donations.abortReason') }}
        confirmLabel={t('ops.donations.abort')}
        loading={actionLoading === aborting?.id}
      />
    </AppShell>
  );
}
