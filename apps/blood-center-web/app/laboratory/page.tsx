'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Beaker,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  DataTable,
  DataTableColumn,
  EmptyState,
  Modal,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import {
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
  createLaboratoryResult,
  reviewLaboratoryResult,
  publishLaboratoryResult,
  getLaboratory,
  LaboratoryAppointment,
  TestType,
} from '../../lib/laboratory';
import { AppShell } from '../../components/AppShell';

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

  // Result entry. The booked test type is not stored on the appointment, so
  // staff choose it here -- the API requires it explicitly when the result is
  // created, and a laboratory usually offers only a handful.
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [entering, setEntering] = useState<LaboratoryAppointment | null>(null);
  const [selectedTestTypeId, setSelectedTestTypeId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const loadAppointments = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingData(true);
    try {
      const data = await getLaboratoryAppointments(organizationId, {
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setAppointments(data);
      setError(null);
    } catch (err: any) {
      // Without this the table just renders empty, which reads as "no
      // appointments today" rather than "we could not reach the server" --
      // the difference between a quiet morning and a missed test.
      setError(err?.message || 'Could not load appointments. Check your connection and retry.');
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

  useEffect(() => {
    if (!organizationId) return;
    getLaboratory(organizationId)
      .then((lab) => setTestTypes(lab.laboratoryProfile?.testTypes ?? []))
      .catch(() => setTestTypes([]));
  }, [organizationId]);

  const selectedTestType = testTypes.find((t) => t.id === selectedTestTypeId);

  const openEntry = (appointment: LaboratoryAppointment) => {
    setEntering(appointment);
    const first = testTypes[0];
    setSelectedTestTypeId(first?.id ?? '');
    setValues({});
  };

  const submitResults = async () => {
    if (!entering || !organizationId || !selectedTestType) return;
    const items = selectedTestType.parameters
      .filter((param) => (values[param.id] ?? '').trim() !== '')
      .map((param) => {
        const raw = values[param.id]!.trim();
        const numeric = Number(raw);
        return {
          parameterId: param.id,
          value: raw,
          // A non-numeric parameter (blood group, Rh) has no numeric value, and
          // sending NaN would store a null the flag logic then cannot read.
          ...(Number.isFinite(numeric) ? { numericValue: numeric } : {}),
          ...(param.unit ? { unit: param.unit } : {}),
        };
      });
    if (!items.length) {
      setError('Enter at least one measurement before saving.');
      return;
    }
    setActionLoading(entering.id);
    try {
      await createLaboratoryResult(organizationId, entering.id, {
        testTypeId: selectedTestType.id,
        items,
      });
      setEntering(null);
      await loadAppointments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save the results');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReview = async (appointment: LaboratoryAppointment) => {
    const resultId = appointment.laboratoryResult?.id;
    if (!organizationId || !resultId) return;
    setActionLoading(appointment.id);
    try {
      await reviewLaboratoryResult(organizationId, resultId);
      await loadAppointments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to review the result');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (appointment: LaboratoryAppointment) => {
    const resultId = appointment.laboratoryResult?.id;
    if (!organizationId || !resultId) return;
    setActionLoading(appointment.id);
    try {
      await publishLaboratoryResult(organizationId, resultId);
      await loadAppointments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish the result');
    } finally {
      setActionLoading(null);
    }
  };

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
        actions.push({ label: 'Sample collected', onClick: () => handleComplete(appointment.id), variant: 'primary' });
        break;
    }

    // Entering, reviewing and publishing a result are the steps that put a
    // number in front of the donor, and none of them had a control here: the
    // console could take a sample and then had nowhere to write down what it
    // found.
    const result = appointment.laboratoryResult;
    if (!result && appointment.status === 'RESULT_PENDING') {
      actions.push({ label: 'Enter results', onClick: () => openEntry(appointment), variant: 'primary' });
    } else if (result?.status === 'ENTERED') {
      actions.push({ label: 'Review', onClick: () => handleReview(appointment), variant: 'primary' });
    } else if (result?.status === 'REVIEWED') {
      actions.push({ label: 'Publish to donor', onClick: () => handlePublish(appointment), variant: 'primary' });
    }

    return actions;
  };

  const columns: DataTableColumn<LaboratoryAppointment>[] = [
    {
      key: 'referenceNumber',
      header: 'Reference',
      render: (appointment) => (
        <span className="font-mono">{appointment.referenceNumber}</span>
      ),
    },
    {
      key: 'donor',
      header: 'Donor',
      render: (appointment) => (
        <div>
          <div className="text-donor-text">
            {appointment.donor.firstName} {appointment.donor.lastName}
          </div>
          <div className="text-xs text-donor-muted">{appointment.donor.email}</div>
        </div>
      ),
    },
    {
      key: 'scheduledStart',
      header: 'Date & Time',
      render: (appointment) =>
        `${new Date(appointment.scheduledStart).toLocaleDateString()} ${new Date(appointment.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (appointment) => {
        const config = statusConfig[appointment.status] || {
          label: appointment.status,
          variant: 'default' as const,
        };
        return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
      },
    },
    {
      key: 'result',
      header: 'Result',
      render: (appointment) =>
        appointment.laboratoryResult ? (
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
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (appointment) => {
        const actions = getActionButtons(appointment);
        return (
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
                    ? 'border border-donor-danger/50 text-donor-danger hover:bg-donor-dangerMuted'
                    : 'border border-donor-border text-donor-text hover:bg-donor-elevated'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const checkedInCount = appointments.filter((a) => a.status === 'CHECKED_IN').length;
  const inProgressCount = appointments.filter((a) => a.status === 'IN_PROGRESS').length;
  const resultPendingCount = appointments.filter((a) => a.status === 'RESULT_PENDING').length;

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Loading..."
        userName="Loading..."
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title="Authentication Required"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Northstar Blood Center"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Beaker className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the laboratory dashboard
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Laboratory"
      subtitle="BLOOD TEST MANAGEMENT"
      organizationName="Northstar Blood Center"
      userName={`${user.firstName} ${user.lastName}`}
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

      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-donor-onDangerMuted">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

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
            className="w-full rounded-lg bc-solid pl-10 pr-4 py-2 text-sm text-donor-text placeholder:text-donor-muted"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
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
          className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {isLoadingData ? (
        <DataTable columns={columns} rows={[]} keyExtractor={(a) => a.id} loading />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments"
          description="No laboratory appointments match your filters."
        />
      ) : (
        <DataTable columns={columns} rows={appointments} keyExtractor={(a) => a.id} />
      )}

      <Modal open={entering !== null} onClose={() => setEntering(null)} title="Enter test results">
        {entering && (
          <div className="space-y-4">
            <p className="text-sm text-donor-muted">
              {entering.donor.firstName} {entering.donor.lastName} — {entering.referenceNumber}
            </p>
            <div>
              <label htmlFor="test-type" className="mb-1 block text-xs font-semibold text-donor-muted">
                Test type
              </label>
              <select
                id="test-type"
                value={selectedTestTypeId}
                onChange={(e) => {
                  setSelectedTestTypeId(e.target.value);
                  setValues({});
                }}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                {testTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTestType?.parameters.length ? (
              <div className="space-y-3">
                {selectedTestType.parameters.map((param) => (
                  <div key={param.id}>
                    <label
                      htmlFor={`param-${param.id}`}
                      className="mb-1 block text-xs font-semibold text-donor-muted"
                    >
                      {param.name}
                      {param.unit ? ` (${param.unit})` : ''}
                    </label>
                    <input
                      id={`param-${param.id}`}
                      type="text"
                      value={values[param.id] ?? ''}
                      onChange={(e) => setValues({ ...values, [param.id]: e.target.value })}
                      className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
                    />
                  </div>
                ))}
                <p className="text-xs text-donor-muted">
                  Values are compared against this laboratory&apos;s reference range for each
                  parameter; the normal/low/high flag the donor sees is derived from that.
                </p>
              </div>
            ) : (
              <p className="text-sm text-donor-muted">This test type has no parameters configured.</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={submitResults}
                disabled={actionLoading === entering.id || !selectedTestType?.parameters.length}
                className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
              >
                {actionLoading === entering.id ? 'Saving...' : 'Save results'}
              </button>
              <button
                onClick={() => setEntering(null)}
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
