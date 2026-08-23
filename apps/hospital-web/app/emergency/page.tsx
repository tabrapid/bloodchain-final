'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  DashboardShell,
  EmptyState,
  Modal,
  StatusBadge,
  StatCard,
} from '@donor/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  createEmergency,
  activateEmergency,
  cancelEmergency,
  confirmArrival,
  getEmergencies,
  EmergencyRequest,
} from '../../lib/emergency';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'donors', label: 'Donors', icon: Package, disabled: true },
  { id: 'appointments', label: 'Appointments', icon: Clock, disabled: true },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
  { id: 'settings', label: 'Settings', icon: AlertCircle, disabled: true },
];

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'];
const URGENCY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  ACTIVE: { label: 'Active', variant: 'info' },
  MATCHING: { label: 'Matching', variant: 'info' },
  RESPONSES_RECEIVED: { label: 'Responses Received', variant: 'warning' },
  DONOR_EN_ROUTE: { label: 'Donor En Route', variant: 'warning' },
  DONOR_ARRIVED: { label: 'Donor Arrived', variant: 'success' },
  DONATION_STARTED: { label: 'Donation Started', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  EXPIRED: { label: 'Expired', variant: 'danger' },
};

interface NewEmergencyForm {
  bloodType: string;
  rhFactor: string;
  unitsRequired: number;
  urgencyLevel: string;
  patientReference: string;
  description: string;
  requiredBefore: string;
  donationLocation: string;
}

export default function EmergencyPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');

  const [newEmergency, setNewEmergency] = useState<NewEmergencyForm>({
    bloodType: 'O',
    rhFactor: 'NEGATIVE',
    unitsRequired: 1,
    urgencyLevel: 'CRITICAL',
    patientReference: '',
    description: '',
    requiredBefore: '',
    donationLocation: '',
  });

  const loadEmergencies = useCallback(async () => {
    if (!organizationId) return;
    try {
      const filters: { status?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await getEmergencies(organizationId, filters);
      setEmergencies(data);
    } catch (err) {
      console.error('Failed to load emergencies:', err);
    }
  }, [organizationId, statusFilter]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const hospitalOrg = userData.organizations.find(
            (org) => org.type === 'HOSPITAL'
          );
          if (hospitalOrg) {
            setOrganizationId(hospitalOrg.organizationId);
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
      loadEmergencies();
    }
  }, [organizationId, loadEmergencies]);

  const handleCreateEmergency = async () => {
    if (!organizationId) return;
    setIsSubmitting(true);
    try {
      await createEmergency(organizationId, newEmergency);
      setShowCreateModal(false);
      setNewEmergency({
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
        unitsRequired: 1,
        urgencyLevel: 'CRITICAL',
        patientReference: '',
        description: '',
        requiredBefore: '',
        donationLocation: '',
      });
      await loadEmergencies();
    } catch (err) {
      console.error('Failed to create emergency:', err);
      alert('Failed to create emergency request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateEmergency = async (emergencyId: string) => {
    if (!organizationId) return;
    try {
      await activateEmergency(organizationId, emergencyId);
      await loadEmergencies();
    } catch (err) {
      console.error('Failed to activate emergency:', err);
      alert('Failed to activate emergency');
    }
  };

  const handleCancelEmergency = async (emergencyId: string) => {
    if (!organizationId) return;
    if (!confirm('Are you sure you want to cancel this emergency?')) return;
    try {
      await cancelEmergency(organizationId, emergencyId);
      await loadEmergencies();
    } catch (err) {
      console.error('Failed to cancel emergency:', err);
      alert('Failed to cancel emergency');
    }
  };

  const handleConfirmArrival = async (responseId: string) => {
    if (!organizationId) return;
    try {
      await confirmArrival(organizationId, responseId);
      await loadEmergencies();
    } catch (err) {
      console.error('Failed to confirm arrival:', err);
      alert('Failed to confirm arrival');
    }
  };

  const activeCount = emergencies.filter(
    (e) => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(e.status)
  ).length;
  const criticalCount = emergencies.filter(
    (e) => e.urgencyLevel === 'CRITICAL' && e.status !== 'COMPLETED' && e.status !== 'CANCELLED'
  ).length;
  const completedCount = emergencies.filter((e) => e.status === 'COMPLETED').length;

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        activeItem="emergency"
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Operations workspace"
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
        subtitle="HOSPITAL CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Operations workspace"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <AlertTriangle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the emergency dashboard
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Emergency SOS"
      subtitle="BLOOD EMERGENCY MANAGEMENT"
      activeItem="emergency"
      sidebarItems={sidebarItems}
      organizationName="Northstar Hospital (Development)"
      organizationType="Hospital Console"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            Emergency Requests
          </h1>
          <p className="text-sm text-donor-muted">
            Manage urgent blood supply requests
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80"
        >
          <Plus size={16} />
          New Emergency
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Active Emergencies"
          value={activeCount.toString()}
          variant={activeCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Critical Priority"
          value={criticalCount.toString()}
          variant={criticalCount > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Completed Today"
          value={completedCount.toString()}
          variant="success"
        />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="MATCHING">Matching</option>
          <option value="RESPONSES_RECEIVED">Responses Received</option>
          <option value="DONOR_EN_ROUTE">Donor En Route</option>
          <option value="DONOR_ARRIVED">Donor Arrived</option>
          <option value="DONATION_STARTED">Donation Started</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button
          onClick={loadEmergencies}
          className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {emergencies.length === 0 ? (
        <EmptyState
          title="No emergency requests"
          description="Create an emergency request when you need urgent blood supply."
        />
      ) : (
        <div className="space-y-4">
          {emergencies.map((emergency) => {
            const config = statusConfig[emergency.status] || {
              label: emergency.status,
              variant: 'default' as const,
            };
            return (
              <div
                key={emergency.id}
                className="rounded-xl border border-donor-border bg-donor-surface p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-full p-3 ${
                        emergency.urgencyLevel === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400'
                          : emergency.urgencyLevel === 'HIGH'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg font-semibold text-donor-text">
                          {emergency.emergencyReference}
                        </h3>
                        <StatusBadge variant={config.variant}>
                          {config.label}
                        </StatusBadge>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            emergency.urgencyLevel === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-400'
                              : emergency.urgencyLevel === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {emergency.urgencyLevel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-donor-muted">
                        {emergency.bloodType}-{emergency.rhFactor} •{' '}
                        {emergency.unitsRequired} unit
                        {emergency.unitsRequired !== 1 ? 's' : ''} required
                        {emergency.patientReference &&
                          ` • Patient: ${emergency.patientReference}`}
                      </p>
                      {emergency.description && (
                        <p className="mt-2 text-sm text-donor-muted">
                          {emergency.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-xs text-donor-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(emergency.createdAt).toLocaleString()}
                        </span>
                        {emergency.donationLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {emergency.donationLocation}
                          </span>
                        )}
                        <span>
                          {emergency.matches.length} matches •{' '}
                          {emergency.responses.length} responses
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emergency.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleActivateEmergency(emergency.id)}
                          className="flex items-center gap-1 rounded-lg bg-donor-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
                        >
                          <CheckCircle2 size={14} />
                          Activate
                        </button>
                        <button
                          onClick={() => handleCancelEmergency(emergency.id)}
                          className="flex items-center gap-1 rounded-lg border border-donor-border bg-donor-surface px-3 py-1.5 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-border"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </>
                    )}
                    {emergency.status === 'DONOR_ARRIVED' && (
                      <button
                        onClick={() => {
                          const response = emergency.responses[0];
                          if (response) {
                            handleConfirmArrival(response.id);
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-donor-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
                      >
                        <CheckCircle2 size={14} />
                        Confirm Arrival
                      </button>
                    )}
                    {![
                      'COMPLETED',
                      'CANCELLED',
                      'EXPIRED',
                      'DRAFT',
                      'DONOR_ARRIVED',
                    ].includes(emergency.status) && (
                      <button
                        onClick={() => handleCancelEmergency(emergency.id)}
                        className="flex items-center gap-1 rounded-lg border border-donor-border bg-donor-surface px-3 py-1.5 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-border"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <Modal
          open={true}
          title="Create Emergency Request"
          onClose={() => setShowCreateModal(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-donor-muted">
                  Blood Type
                </label>
                <select
                  value={newEmergency.bloodType}
                  onChange={(e) =>
                    setNewEmergency({ ...newEmergency, bloodType: e.target.value })
                  }
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                >
                  {BLOOD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-donor-muted">
                  Rh Factor
                </label>
                <select
                  value={newEmergency.rhFactor}
                  onChange={(e) =>
                    setNewEmergency({
                      ...newEmergency,
                      rhFactor: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                >
                  {RH_FACTORS.map((rh) => (
                    <option key={rh} value={rh}>
                      {rh === 'POSITIVE' ? '+' : '-'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-donor-muted">
                  Units Required
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newEmergency.unitsRequired}
                  onChange={(e) =>
                    setNewEmergency({
                      ...newEmergency,
                      unitsRequired: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Urgency Level
              </label>
              <select
                value={newEmergency.urgencyLevel}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    urgencyLevel: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
              >
                {URGENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Patient Reference
              </label>
              <input
                type="text"
                placeholder="Optional patient identifier"
                value={newEmergency.patientReference}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    patientReference: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Description
              </label>
              <textarea
                placeholder="Additional details about the emergency..."
                value={newEmergency.description}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    description: e.target.value,
                  })
                }
                rows={3}
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Required Before
              </label>
              <input
                type="datetime-local"
                value={newEmergency.requiredBefore}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    requiredBefore: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Donation Location
              </label>
              <input
                type="text"
                placeholder="Address or location for donor to go"
                value={newEmergency.donationLocation}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    donationLocation: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-donor-border bg-donor-surface px-4 py-2 font-semibold text-donor-text transition-colors hover:bg-donor-border"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEmergency}
                disabled={isSubmitting}
                className="rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Emergency'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
