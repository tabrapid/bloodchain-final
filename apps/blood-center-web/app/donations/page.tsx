'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Droplet, RefreshCw, Search } from 'lucide-react';
import {
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

const appointmentStatus: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  CHECKED_IN: { label: 'Checked in', variant: 'info' },
  IN_PROGRESS: { label: 'In progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  NO_SHOW: { label: 'No show', variant: 'danger' },
};

const donationStatus: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  CHECKED_IN: { label: 'Checked in', variant: 'info' },
  ASSESSED: { label: 'Cleared to donate', variant: 'info' },
  IN_PROGRESS: { label: 'Collecting', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  DEFERRED: { label: 'Deferred', variant: 'warning' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  ABORTED: { label: 'Aborted', variant: 'danger' },
};

const DEFAULT_VOLUME_ML = 450;

function fullName(donor?: { firstName: string; lastName: string }) {
  return donor ? `${donor.firstName} ${donor.lastName}` : '—';
}

export default function DonationsPage() {
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
      setError(err instanceof Error ? err.message : 'Could not load donations. Check the API and retry.');
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
        label: 'Check in',
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
          label: 'Approve',
          variant: 'primary',
          onClick: () =>
            act(
              donation.id,
              () => recordAssessment(organizationId, donation.id, { decision: 'APPROVED_FOR_DONATION' }),
              'Failed to record the assessment',
            ),
        });
        buttons.push({
          label: 'Defer',
          variant: 'danger',
          onClick: () => {
            const notes = prompt('Why is this donor being deferred?');
            if (!notes) return;
            act(
              donation.id,
              () => recordAssessment(organizationId, donation.id, { decision: 'DEFERRED', notes }),
              'Failed to record the deferral',
            );
          },
        });
      } else if (donation.assessment.decision === 'APPROVED_FOR_DONATION') {
        buttons.push({
          label: 'Start collection',
          variant: 'primary',
          onClick: () =>
            act(donation.id, () => startCollection(organizationId, donation.id), 'Failed to start collection'),
        });
      }
    }
    if (donation?.status === 'IN_PROGRESS') {
      buttons.push({ label: 'Complete', variant: 'primary', onClick: () => openCompletion(donation) });
      buttons.push({
        label: 'Abort',
        variant: 'danger',
        onClick: () => {
          const reason = prompt('Why is this collection being aborted?');
          if (!reason) return;
          act(donation.id, () => abortDonation(organizationId, donation.id, { reason }), 'Failed to abort');
        },
      });
    }

    return { buttons, busy };
  };

  const appointmentColumns: DataTableColumn<DonationAppointment>[] = [
    {
      key: 'referenceNumber',
      header: 'Reference',
      render: (a) => <span className="font-mono">{a.referenceNumber}</span>,
    },
    {
      key: 'donor',
      header: 'Donor',
      render: (a) => (
        <div>
          <div className="text-donor-text">{fullName(a.donor)}</div>
          <div className="text-xs text-donor-muted">{a.donor?.email}</div>
        </div>
      ),
    },
    {
      key: 'scheduledStart',
      header: 'Time',
      render: (a) =>
        new Date(a.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'status',
      header: 'Stage',
      render: (a) => {
        const donation = donationFor(a);
        if (!donation) {
          const fallback = appointmentStatus[a.status] ?? { label: a.status, variant: 'default' as const };
          return <StatusBadge variant={fallback.variant}>{fallback.label}</StatusBadge>;
        }
        const key =
          donation.status === 'CHECKED_IN' && donation.assessment?.decision === 'APPROVED_FOR_DONATION'
            ? 'ASSESSED'
            : donation.status === 'CHECKED_IN' && donation.assessment
              ? 'DEFERRED'
              : donation.status;
        const config = donationStatus[key] ?? { label: donation.status, variant: 'default' as const };
        return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
      },
    },
    {
      key: 'volume',
      header: 'Volume',
      render: (a) => {
        const donation = donationFor(a);
        return donation?.volumeMl ? `${donation.volumeMl} mL` : <span className="text-donor-muted">—</span>;
      },
    },
    {
      key: 'actions',
      header: 'Next step',
      className: 'text-right',
      render: (a) => {
        const { buttons, busy } = appointmentActions(a);
        if (!buttons.length) return <span className="text-xs text-donor-muted">No action needed</span>;
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
      header: 'Reference',
      render: (d) => <span className="font-mono">{d.donationReference}</span>,
    },
    { key: 'donor', header: 'Donor', render: (d) => fullName(d.donor) },
    {
      key: 'bloodType',
      header: 'Group',
      render: (d) =>
        d.bloodType ? `${d.bloodType}${d.rhFactor === 'POSITIVE' ? '+' : d.rhFactor === 'NEGATIVE' ? '−' : ''}` : '—',
    },
    { key: 'volumeMl', header: 'Volume', render: (d) => (d.volumeMl ? `${d.volumeMl} mL` : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (d) => {
        const config = donationStatus[d.status] ?? { label: d.status, variant: 'default' as const };
        return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
      },
    },
    {
      key: 'completedAt',
      header: 'Completed',
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
      <AppShell title="Loading..." subtitle="BLOOD CENTER CONSOLE">
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Sign in required" subtitle="BLOOD CENTER CONSOLE">
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Droplet className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">Sign in required</h2>
          <p className="text-center text-donor-muted">Sign in to manage donations.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Donations"
      subtitle="BLOOD CENTER CONSOLE"
      userName={`${user.firstName} ${user.lastName}`}
      organizationName={user.organizations[0]?.name}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-donor-text">Donations</h1>
        <p className="text-sm text-donor-muted">
          Receive today&apos;s donors, record the assessment, and save the volume collected.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-donor-onDangerMuted">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Waiting to check in" value={String(waiting)} variant={waiting > 0 ? 'warning' : 'default'} />
        <StatCard label="In progress" value={String(inProgress)} variant={inProgress > 0 ? 'info' : 'default'} />
        <StatCard label="Completed today" value={String(completedToday)} variant="success" />
        <StatCard label="Collected today" value={`${volumeToday} mL`} variant="success" />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={16} />
          <input
            type="text"
            placeholder="Search donations by reference or donor..."
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
          Refresh
        </button>
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-donor-text">Today&apos;s appointments</h2>
      <div className="mb-8">
        <DataTable
          columns={appointmentColumns}
          rows={appointments}
          keyExtractor={(a) => a.id}
          loading={isLoadingData}
          emptyMessage="No donation appointments booked for today."
        />
      </div>

      <h2 className="mb-2 font-display text-lg font-semibold text-donor-text">Recent donations</h2>
      <DataTable
        columns={donationColumns}
        rows={donations}
        keyExtractor={(d) => d.id}
        loading={isLoadingData}
        emptyMessage="No donations recorded yet."
      />

      <Modal
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title="Complete donation"
      >
        {completing && (
          <div className="space-y-4">
            <p className="text-sm text-donor-muted">
              {fullName(completing.donor)} — {completing.donationReference}
            </p>
            <div>
              <label htmlFor="volume-ml" className="mb-1 block text-xs font-semibold text-donor-muted">
                Volume collected (mL)
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
                This is the figure the donor sees in their own donation history.
              </p>
            </div>
            <div>
              <label htmlFor="staff-notes" className="mb-1 block text-xs font-semibold text-donor-muted">
                Notes (optional)
              </label>
              <input
                id="staff-notes"
                type="text"
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="e.g. Hb 14.2 g/dL, BP 120/78"
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={submitCompletion}
                disabled={actionLoading === completing.id}
                className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
              >
                {actionLoading === completing.id ? 'Saving...' : 'Save donation'}
              </button>
              <button
                onClick={() => setCompleting(null)}
                className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
