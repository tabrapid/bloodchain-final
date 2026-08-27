'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  Beaker,
  CalendarDays,
  CheckCircle,
  Clock,
  Filter,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  Settings,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  DashboardShell,
  DataTable,
  DataTableColumn,
  EmptyState,
  Modal,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import {
  login,
  logout as logoutApi,
  me,
  isAuthenticated,
  MeResponse,
} from '../../lib/auth';
import {
  getLaboratoryAppointments,
  confirmLaboratoryAppointment,
  checkInLaboratoryAppointment,
  startLaboratoryTest,
  completeLaboratoryAppointment,
  markLaboratoryNoShow,
  LaboratoryAppointment,
} from '../../lib/laboratory';
import { sidebarItems } from '../../lib/navigation';

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  CHECKED_IN: { label: 'Checked In', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  RESULT_PENDING: { label: 'Result Pending', variant: 'warning' },
  RESULT_READY: { label: 'Result Ready', variant: 'success' },
  RESULT_PUBLISHED: { label: 'Published', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  NO_SHOW: { label: 'No Show', variant: 'danger' },
};

export default function LaboratoryPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<LaboratoryAppointment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingData(true);
    try {
      const data = await getLaboratoryAppointments(organizationId, {
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setAppointments(data);
    } catch (err: any) {
      console.error('Failed to load appointments:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [organizationId, statusFilter, searchQuery]);

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
            setOrganizationId(userData.organizations[0]!.organizationId);
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
      loadAppointments();
    }
  }, [organizationId, loadAppointments]);

  const handleConfirm = async (appointmentId: string) => {
    if (!organizationId) return;
    setActionLoading(appointmentId);
    try {
      await confirmLaboratoryAppointment(organizationId, appointmentId);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm appointment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    if (!organizationId) return;
    setActionLoading(appointmentId);
    try {
      await checkInLaboratoryAppointment(organizationId, appointmentId);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to check in');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (appointmentId: string) => {
    if (!organizationId) return;
    setActionLoading(appointmentId);
    try {
      await startLaboratoryTest(organizationId, appointmentId);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to start test');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (appointmentId: string) => {
    if (!organizationId) return;
    setActionLoading(appointmentId);
    try {
      await completeLaboratoryAppointment(organizationId, appointmentId);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to complete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    if (!organizationId) return;
    if (!confirm('Mark this appointment as no-show?')) return;
    setActionLoading(appointmentId);
    try {
      await markLaboratoryNoShow(organizationId, appointmentId);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to mark no-show');
    } finally {
      setActionLoading(null);
    }
  };

  const getActionButtons = (appointment: LaboratoryAppointment) => {
    const actions: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }[] = [];

    switch (appointment.status) {
      case 'PENDING':
        actions.push({ label: 'Confirm', onClick: () => handleConfirm(appointment.id), variant: 'primary' });
        actions.push({ label: 'No Show', onClick: () => handleNoShow(appointment.id), variant: 'danger' });
        break;
      case 'CONFIRMED':
        actions.push({ label: 'Check In', onClick: () => handleCheckIn(appointment.id), variant: 'primary' });
        actions.push({ label: 'No Show', onClick: () => handleNoShow(appointment.id), variant: 'danger' });
        break;
      case 'CHECKED_IN':
        actions.push({ label: 'Start Test', onClick: () => handleStart(appointment.id), variant: 'primary' });
        break;
      case 'IN_PROGRESS':
        actions.push({ label: 'Complete Test', onClick: () => handleComplete(appointment.id), variant: 'primary' });
        break;
    }

    return actions;
  };

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const checkedInCount = appointments.filter((a) => a.status === 'CHECKED_IN').length;
  const inProgressCount = appointments.filter((a) => a.status === 'IN_PROGRESS').length;
  const resultPendingCount = appointments.filter((a) => a.status === 'RESULT_PENDING').length;

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        activeItem="laboratory"
        sidebarItems={sidebarItems}
        organizationName="Loading..."
        userName="Loading..."
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
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
        organizationName="Northstar Blood Center"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <Beaker className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the laboratory dashboard
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Laboratory"
      subtitle="BLOOD TEST MANAGEMENT"
      activeItem="laboratory"
      sidebarItems={sidebarItems}
      organizationName="Northstar Blood Center"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            Laboratory Appointments
          </h1>
          <p className="text-sm text-donor-muted">
            Manage blood test appointments and results
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <StatCard
          label="Pending"
          value={pendingCount.toString()}
          variant={pendingCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Confirmed"
          value={confirmedCount.toString()}
          variant="info"
        />
        <StatCard
          label="Checked In"
          value={checkedInCount.toString()}
          variant="info"
        />
        <StatCard
          label="In Progress"
          value={inProgressCount.toString()}
          variant={inProgressCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Result Pending"
          value={resultPendingCount.toString()}
          variant={resultPendingCount > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={16} />
          <input
            type="text"
            placeholder="Search by reference or donor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-donor-border bg-donor-surface pl-10 pr-4 py-2 text-sm text-donor-text placeholder:text-donor-muted"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESULT_PENDING">Result Pending</option>
          <option value="RESULT_READY">Result Ready</option>
          <option value="RESULT_PUBLISHED">Published</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
        </select>
        <button
          onClick={loadAppointments}
          disabled={isLoadingData}
          className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-4 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-border disabled:opacity-50"
        >
          <Filter size={14} />
          Refresh
        </button>
      </div>

      {isLoadingData ? (
        <div className="flex items-center justify-center rounded-xl border border-donor-border bg-donor-surface p-12">
          <Activity className="animate-spin text-donor-primary" size={24} />
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments"
          description="No laboratory appointments match your filters."
        />
      ) : (
        <div className="rounded-xl border border-donor-border bg-donor-surface overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-donor-border bg-donor-surfaceElevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Donor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Date & Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Result
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-donor-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-donor-border">
              {appointments.map((appointment) => {
                const config = statusConfig[appointment.status] || {
                  label: appointment.status,
                  variant: 'default' as const,
                };
                const actions = getActionButtons(appointment);
                return (
                  <tr key={appointment.id} className="hover:bg-donor-surfaceElevated/50">
                    <td className="px-4 py-3 text-sm font-mono text-donor-text">
                      {appointment.referenceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-donor-text">
                        {appointment.donor.firstName} {appointment.donor.lastName}
                      </div>
                      <div className="text-xs text-donor-muted">
                        {appointment.donor.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-donor-text">
                      {new Date(appointment.scheduledStart).toLocaleDateString()} {new Date(appointment.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      {appointment.laboratoryResult ? (
                        <StatusBadge
                          variant={
                            appointment.laboratoryResult.status === 'PUBLISHED'
                              ? 'success'
                              : appointment.laboratoryResult.status === 'REVIEWED'
                              ? 'info'
                              : 'warning'
                          }
                        >
                          {appointment.laboratoryResult.status}
                        </StatusBadge>
                      ) : (
                        <span className="text-xs text-donor-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={action.onClick}
                            disabled={actionLoading === appointment.id}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              action.variant === 'primary'
                                ? 'bg-donor-primary text-white hover:bg-donor-primary/80'
                                : action.variant === 'danger'
                                ? 'border border-red-500/50 text-red-400 hover:bg-red-500/20'
                                : 'border border-donor-border text-donor-text hover:bg-donor-border'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
