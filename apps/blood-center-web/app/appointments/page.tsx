'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Ban, CalendarDays, Clock, Plus, RefreshCw, Users } from 'lucide-react';
import {
  DashboardShell,
  EmptyState,
  Modal,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  getSlots,
  createSlot,
  blockSlot,
  AppointmentSlot,
  AppointmentType,
} from '../../lib/appointment-slots';
import { sidebarItems } from '../../lib/navigation';

const TYPE_LABEL: Record<AppointmentType, string> = {
  BLOOD_DONATION: 'Blood Donation',
  BLOOD_TEST: 'Blood Test',
  CONSULTATION: 'Consultation',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  FULL: { label: 'Full', variant: 'warning' },
  BLOCKED: { label: 'Blocked', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  EXPIRED: { label: 'Expired', variant: 'default' },
};

function toDatetimeLocalInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AppointmentSlotsPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [typeFilter, setTypeFilter] = useState<AppointmentType | ''>('');
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    appointmentType: 'BLOOD_DONATION' as AppointmentType,
    startAt: '',
    endAt: '',
    capacity: 1,
  });

  const loadSlots = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const filters: { appointmentType?: AppointmentType; startDate?: string } = {
        startDate: startDate.toISOString(),
      };
      if (typeFilter) filters.appointmentType = typeFilter;
      const data = await getSlots(organizationId, filters);
      setSlots(data.data);
    } catch (err) {
      console.error('Failed to load appointment slots:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, typeFilter]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const org = userData.organizations.find(
            (o) => o.type === 'BLOOD_CENTER' || o.type === 'BLOOD_CENTER_ADMIN'
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
      loadSlots();
    }
  }, [organizationId, loadSlots]);

  const openCreateModal = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setMinutes(30);
    setForm({
      appointmentType: 'BLOOD_DONATION',
      startAt: toDatetimeLocalInput(start),
      endAt: toDatetimeLocalInput(end),
      capacity: 1,
    });
    setActionError(null);
    setShowCreateModal(true);
  };

  const handleCreateSlot = async () => {
    if (!organizationId || !form.startAt || !form.endAt) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await createSlot(organizationId, {
        appointmentType: form.appointmentType,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        capacity: form.capacity,
      });
      setShowCreateModal(false);
      await loadSlots();
    } catch (err) {
      console.error('Failed to create slot:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to create slot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockSlot = async (slotId: string) => {
    if (!organizationId) return;
    if (!confirm('Block this slot? Donors will no longer be able to book it.')) return;
    try {
      await blockSlot(organizationId, slotId);
      await loadSlots();
    } catch (err) {
      console.error('Failed to block slot:', err);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        activeItem="appointments"
        sidebarItems={sidebarItems}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Loading..."
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex items-center justify-center p-12">
          <CalendarDays className="animate-spin text-donor-primary" size={32} />
        </div>
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell
        title="Authentication Required"
        subtitle="BLOOD CENTER CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <CalendarDays className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to configure appointment slots
          </p>
        </div>
      </DashboardShell>
    );
  }

  const upcomingSlots = [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const fullCount = slots.filter((s) => s.status === 'FULL').length;
  const totalCapacity = slots.reduce((sum, s) => sum + s.capacity, 0);
  const totalBooked = slots.reduce((sum, s) => sum + s.bookedCount, 0);

  return (
    <DashboardShell
      title="Appointment Slots"
      subtitle="BLOOD CENTER OPERATIONS"
      activeItem="appointments"
      sidebarItems={sidebarItems}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            Appointment Slots
          </h1>
          <p className="text-sm text-donor-muted">
            Configure when donors can book donation, blood test, and consultation appointments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSlots}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
          >
            <Plus size={16} />
            New Slot
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AppointmentType | '')}
          className="rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
        >
          <option value="">All Types</option>
          <option value="BLOOD_DONATION">Blood Donation</option>
          <option value="BLOOD_TEST">Blood Test</option>
          <option value="CONSULTATION">Consultation</option>
        </select>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Upcoming Slots" value={slots.length.toString()} icon={CalendarDays} variant="info" />
        <StatCard label="Available" value={availableCount.toString()} icon={Clock} variant="success" />
        <StatCard label="Full" value={fullCount.toString()} icon={Users} variant="warning" />
        <StatCard label="Capacity Booked" value={`${totalBooked} / ${totalCapacity}`} icon={Users} variant="default" />
      </div>

      {upcomingSlots.length === 0 ? (
        <EmptyState
          title="No upcoming appointment slots"
          description="Create a slot so donors can book donation, blood test, or consultation appointments."
        />
      ) : (
        <div className="space-y-3">
          {upcomingSlots.map((slot) => {
            const status = STATUS_CONFIG[slot.status] || { label: slot.status, variant: 'default' as const };
            const start = new Date(slot.startAt);
            const end = new Date(slot.endAt);
            const canBlock = slot.status === 'AVAILABLE' || slot.status === 'FULL';
            return (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-xl border border-donor-border bg-donor-surface p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-donor-primary/20 p-3">
                    <CalendarDays size={20} className="text-donor-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-donor-text">
                        {TYPE_LABEL[slot.appointmentType]}
                      </h3>
                      <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-donor-muted">
                      {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right text-sm">
                    <p className="text-donor-muted">Booked</p>
                    <p className="font-semibold text-donor-text">
                      {slot.bookedCount} / {slot.capacity}
                    </p>
                  </div>
                  {canBlock && (
                    <button
                      onClick={() => handleBlockSlot(slot.id)}
                      className="flex items-center gap-2 rounded-lg border border-donor-border px-3 py-2 text-xs font-semibold text-donor-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                    >
                      <Ban size={14} />
                      Block
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Appointment Slot">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-donor-muted">Type</label>
            <select
              value={form.appointmentType}
              onChange={(e) => setForm({ ...form, appointmentType: e.target.value as AppointmentType })}
              className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
            >
              <option value="BLOOD_DONATION">Blood Donation</option>
              <option value="BLOOD_TEST">Blood Test</option>
              <option value="CONSULTATION">Consultation</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Start</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">End</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-donor-muted">Capacity</label>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-sm text-donor-text"
            />
          </div>

          {actionError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={14} />
              {actionError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreateSlot}
              disabled={actionLoading || !form.startAt || !form.endAt}
              className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create Slot'}
            </button>
            <button
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-donor-border bg-donor-surface px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
