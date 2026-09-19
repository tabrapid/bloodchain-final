'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  EmptyState,
  Modal,
  StatusBadge,
  StatCard,
} from '@bloodchain/ui/components';
import type { MapMarker } from '@bloodchain/ui/map';

const LocationMap = dynamic(() => import('@bloodchain/ui/map').then((mod) => mod.LocationMap), {
  ssr: false,
});
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  createEmergency,
  activateEmergency,
  cancelEmergency,
  confirmArrival,
  completeEmergencyDonation,
  getEmergencies,
  EmergencyRequest,
} from '../../lib/emergency';
import { useEmergencyTracking } from '../../lib/useEmergencyTracking';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'];
const URGENCY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'];

/**
 * Badge colour per status; the wording comes from
 * `t('status.emergency.<STATUS>')` at render, because a label written into
 * a module-level map can only ever be in one language.
 */
const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  DRAFT: 'default',
  ACTIVE: 'info',
  MATCHING: 'info',
  RESPONSES_RECEIVED: 'warning',
  DONOR_EN_ROUTE: 'warning',
  DONOR_ARRIVED: 'success',
  DONATION_STARTED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
};

interface NewEmergencyForm {
  bloodType: string;
  rhFactor: string;
  componentType: string;
  unitsRequired: number;
  urgencyLevel: string;
  patientReference: string;
  description: string;
  requiredBefore: string;
  donationLocation: string;
}

export default function EmergencyPage() {
  const { t } = useTranslation();
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
    componentType: 'WHOLE_BLOOD',
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
      // Every optional text field in this form starts as an empty string, and
      // the API validates them as an ISO date / non-empty string rather than
      // ignoring them -- so submitting the form without filling in the optional
      // deadline failed with "requiredBefore must be a valid ISO 8601 date
      // string", which is the ordinary case, not the edge one. Send only what
      // was actually filled in.
      await createEmergency(organizationId, {
        ...newEmergency,
        requiredBefore: newEmergency.requiredBefore
          ? new Date(newEmergency.requiredBefore).toISOString()
          : undefined,
        patientReference: newEmergency.patientReference || undefined,
        description: newEmergency.description || undefined,
        donationLocation: newEmergency.donationLocation || undefined,
      });
      setShowCreateModal(false);
      setNewEmergency({
        bloodType: 'O',
        rhFactor: 'NEGATIVE',
        componentType: 'WHOLE_BLOOD',
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

  const handleCompleteDonation = async (responseId: string) => {
    if (!organizationId) return;
    const volumeInput = prompt('Collected volume (mL)', '450');
    if (volumeInput === null) return;
    const volumeMl = parseInt(volumeInput, 10);
    try {
      await completeEmergencyDonation(organizationId, responseId, {
        volumeMl: Number.isFinite(volumeMl) ? volumeMl : undefined,
      });
      await loadEmergencies();
    } catch (err) {
      console.error('Failed to complete donation:', err);
      alert('Failed to complete donation');
    }
  };

  const activeCount = emergencies.filter(
    (e) => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(e.status)
  ).length;
  const criticalCount = emergencies.filter(
    (e) => e.urgencyLevel === 'CRITICAL' && e.status !== 'COMPLETED' && e.status !== 'CANCELLED'
  ).length;
  const completedCount = emergencies.filter((e) => e.status === 'COMPLETED').length;

  const trackedEmergencyIds = emergencies
    .filter((e) => ['DONOR_EN_ROUTE', 'DONOR_ARRIVED'].includes(e.status))
    .map((e) => e.id);
  const { locations: liveLocations } = useEmergencyTracking(trackedEmergencyIds);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName={t('ops.common.loadingEllipsis')}
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
        title={t('portal.authRequired')}
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <AlertTriangle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('ops.common.signInToEmergency')}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('ops.emergency.title')}
      subtitle={t('ops.emergency.management')}
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Hospital Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            {t('home.emergencyRequests')}
          </h1>
          <p className="text-sm text-donor-muted">
            {t('ops.emergency.pageSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80"
        >
          <Plus size={16} />
          {t('ops.emergency.newEmergency')}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label={t('ops.dashboard.activeEmergencies')}
          value={activeCount.toString()}
          variant={activeCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label={t('ops.emergency.criticalPriority')}
          value={criticalCount.toString()}
          variant={criticalCount > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('ops.emergency.completedToday')}
          value={completedCount.toString()}
          variant="success"
        />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">{t('filters.allStatuses')}</option>
          <option value="DRAFT">{t('status.emergency.DRAFT')}</option>
          <option value="ACTIVE">{t('status.emergency.ACTIVE')}</option>
          <option value="MATCHING">{t('status.emergency.MATCHING')}</option>
          <option value="RESPONSES_RECEIVED">{t('status.emergency.RESPONSES_RECEIVED')}</option>
          <option value="DONOR_EN_ROUTE">{t('status.emergency.DONOR_EN_ROUTE')}</option>
          <option value="DONOR_ARRIVED">{t('status.emergency.DONOR_ARRIVED')}</option>
          <option value="DONATION_STARTED">{t('status.emergency.DONATION_STARTED')}</option>
          <option value="COMPLETED">{t('table.completedAt')}</option>
          <option value="CANCELLED">{t('appointment.cancelledNotice')}</option>
        </select>
        <button
          onClick={loadEmergencies}
          className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
        >
          <RefreshCw size={14} />
          {t('actions.refresh')}
        </button>
      </div>

      {emergencies.length === 0 ? (
        <EmptyState
          title={t('ops.emergency.empty')}
          description={t('ops.emergency.emptyHint')}
        />
      ) : (
        <div className="space-y-4">
          {emergencies.map((emergency) => {
            const emergencyVariant = statusVariant[emergency.status] ?? 'default';
            return (
              <div
                key={emergency.id}
                className="bc-glass rounded-card p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-full p-3 ${
                        emergency.urgencyLevel === 'CRITICAL'
                          ? 'bg-donor-dangerMuted text-donor-onDangerMuted'
                          : emergency.urgencyLevel === 'HIGH'
                          ? 'bg-donor-warningMuted text-donor-onWarningMuted'
                          : 'bg-donor-warningMuted/70 text-donor-onWarningMuted'
                      }`}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg font-semibold text-donor-text">
                          {emergency.emergencyReference}
                        </h3>
                        <StatusBadge variant={emergencyVariant}>
                          {t(`status.emergency.${emergency.status}`)}
                        </StatusBadge>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            emergency.urgencyLevel === 'CRITICAL'
                              ? 'bg-donor-dangerMuted text-donor-onDangerMuted'
                              : emergency.urgencyLevel === 'HIGH'
                              ? 'bg-donor-warningMuted text-donor-onWarningMuted'
                              : 'bg-donor-warningMuted/70 text-donor-onWarningMuted'
                          }`}
                        >
                          {emergency.urgencyLevel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-donor-muted">
                        {emergency.bloodType}-{emergency.rhFactor} •{' '}
                        {t(`medical.components.${emergency.componentType}`)} •{' '}
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
                      {['DONOR_EN_ROUTE', 'DONOR_ARRIVED'].includes(emergency.status) && (() => {
                        const liveLocation = liveLocations[emergency.id];
                        if (!liveLocation) {
                          return (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-donor-border bc-solid px-3 py-2">
                              <Navigation size={14} className="text-donor-primary" />
                              <span className="text-xs text-donor-muted">
                                {t('ops.couriers.awaitingLocation')}
                              </span>
                            </div>
                          );
                        }

                        const hospitalLat = emergency.latitude ? parseFloat(emergency.latitude) : null;
                        const hospitalLng = emergency.longitude ? parseFloat(emergency.longitude) : null;
                        const markers: MapMarker[] = [
                          {
                            id: 'donor',
                            variant: 'donor',
                            label: t('table.donor'),
                            sublabel: `Updated ${new Date(liveLocation.recordedAt).toLocaleTimeString()}`,
                            latitude: liveLocation.latitude,
                            longitude: liveLocation.longitude,
                          },
                          ...(hospitalLat !== null && hospitalLng !== null
                            ? [{
                                id: 'hospital',
                                variant: 'hospital' as const,
                                label: emergency.donationLocation || 'Hospital',
                                sublabel: t('ops.emergency.donationLocation'),
                                latitude: hospitalLat,
                                longitude: hospitalLng,
                              }]
                            : []),
                        ];

                        return (
                          <div className="mt-3">
                            <LocationMap markers={markers} showRoute height={220} />
                          </div>
                        );
                      })()}
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
                          {t('ops.common.activate')}
                        </button>
                        <button
                          onClick={() => handleCancelEmergency(emergency.id)}
                          className="flex items-center gap-1 rounded-lg bc-solid px-3 py-1.5 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
                        >
                          <X size={14} />
                          {t('actions.cancel')}
                        </button>
                      </>
                    )}
                    {emergency.status === 'DONOR_ARRIVED' && (
                      <button
                        onClick={() => {
                          // Multiple donors can respond to one emergency; only the
                          // one whose own response reached ARRIVED is the one
                          // actually at reception -- responses[0] is whoever
                          // responded first, not necessarily them.
                          const response = emergency.responses.find((r) => r.status === 'ARRIVED');
                          if (response) {
                            handleConfirmArrival(response.id);
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-donor-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
                      >
                        <CheckCircle2 size={14} />
                        {t('ops.couriers.confirmArrival')}
                      </button>
                    )}
                    {emergency.status === 'DONATION_STARTED' && (
                      <button
                        onClick={() => {
                          const response = emergency.responses.find((r) => r.status === 'DONATION_STARTED');
                          if (response) {
                            handleCompleteDonation(response.id);
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-donor-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
                      >
                        <CheckCircle2 size={14} />
                        {t('ops.donations.complete')}
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
                        className="flex items-center gap-1 rounded-lg bc-solid px-3 py-1.5 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
                      >
                        <X size={14} />
                        {t('actions.cancel')}
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
          title={t('ops.emergency.create')}
          onClose={() => setShowCreateModal(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-donor-muted">
                  {t('home.bloodTypeLabel')}
                </label>
                <select
                  value={newEmergency.bloodType}
                  onChange={(e) =>
                    setNewEmergency({ ...newEmergency, bloodType: e.target.value })
                  }
                  className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
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
                  {t('medical.rhFactor')}
                </label>
                <select
                  value={newEmergency.rhFactor}
                  onChange={(e) =>
                    setNewEmergency({
                      ...newEmergency,
                      rhFactor: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
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
                  {t('ops.requests.unitsRequired')}
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
                  className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.requests.urgencyLevel')}
              </label>
              <select
                value={newEmergency.urgencyLevel}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    urgencyLevel: e.target.value,
                  })
                }
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
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
                {t('ops.requests.componentNeeded')}
              </label>
              <select
                value={newEmergency.componentType}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    componentType: e.target.value,
                  })
                }
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
              >
                {COMPONENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`medical.components.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.requests.patientReference')}
              </label>
              <input
                type="text"
                placeholder={t('ops.emergency.patientPlaceholder')}
                value={newEmergency.patientReference}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    patientReference: e.target.value,
                  })
                }
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('sos.description')}
              </label>
              <textarea
                placeholder={t('ops.emergency.detailsPlaceholder')}
                value={newEmergency.description}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    description: e.target.value,
                  })
                }
                rows={3}
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.requests.requiredBefore')}
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
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('ops.emergency.donationLocation')}
              </label>
              <input
                type="text"
                placeholder={t('ops.emergency.locationPlaceholder')}
                value={newEmergency.donationLocation}
                onChange={(e) =>
                  setNewEmergency({
                    ...newEmergency,
                    donationLocation: e.target.value,
                  })
                }
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg bc-solid px-4 py-2 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
              >
                {t('actions.cancel')}
              </button>
              <button
                onClick={handleCreateEmergency}
                disabled={isSubmitting}
                className="rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
              >
                {isSubmitting ? t('ops.common.creating') : t('ops.emergency.createEmergency')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
