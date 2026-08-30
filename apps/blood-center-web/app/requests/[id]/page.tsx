'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Droplet,
  Truck,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import {
  getBloodRequest,
  approveBloodRequest,
  markReadyForPickup,
  createShipment,
  BloodRequest,
} from '../../../lib/shipments';
import { AppShell } from '../../../components/AppShell';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  SUBMITTED: { label: 'Submitted', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'info' },
  APPROVED: { label: 'Approved', variant: 'success' },
  PARTIALLY_APPROVED: { label: 'Partially Approved', variant: 'warning' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', variant: 'warning' },
  IN_TRANSIT: { label: 'In Transit', variant: 'info' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', variant: 'warning' },
};

export default function BloodRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, number>>({});
  const [reviewNotes, setReviewNotes] = useState('');

  const loadRequest = useCallback(async () => {
    if (!organizationId || !requestId) return;
    try {
      const data = await getBloodRequest(organizationId, requestId);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load blood request:', err);
    }
  }, [organizationId, requestId]);

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
    if (organizationId) loadRequest();
  }, [organizationId, loadRequest]);

  const openReviewModal = () => {
    if (!request) return;
    const defaults: Record<string, number> = {};
    request.items.forEach((item) => {
      defaults[item.id] = item.unitsRequested;
    });
    setApprovals(defaults);
    setReviewNotes('');
    setActionError(null);
    setShowReviewModal(true);
  };

  const submitReview = async (mode: 'approve' | 'reject') => {
    if (!request || !organizationId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const items = request.items.map((item) => ({
        itemId: item.id,
        unitsApproved: mode === 'reject' ? 0 : Math.max(0, approvals[item.id] ?? 0),
      }));
      await approveBloodRequest(organizationId, requestId, { items, notes: reviewNotes.trim() || undefined });
      setShowReviewModal(false);
      await loadRequest();
    } catch (err) {
      console.error('Failed to review blood request:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReady = async () => {
    if (!organizationId || !requestId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await markReadyForPickup(organizationId, requestId);
      await loadRequest();
    } catch (err) {
      console.error('Failed to mark ready for pickup:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to mark ready for pickup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!organizationId || !requestId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const shipment = await createShipment(organizationId, requestId);
      router.push(`/shipments/${shipment.id}`);
    } catch (err) {
      console.error('Failed to create shipment:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to create shipment');
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Loading..."
      >
        <div className="flex items-center justify-center p-12">
          <Droplet className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user || !request) {
    return (
      <AppShell
        title="Request Not Found"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <XCircle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Request Not Found
          </h2>
          <button
            onClick={() => router.push('/requests')}
            className="mt-4 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white"
          >
            Back to Requests
          </button>
        </div>
      </AppShell>
    );
  }

  const status = STATUS_CONFIG[request.status] || { label: request.status, variant: 'default' as const };
  const totalRequested = request.items.reduce((sum, i) => sum + i.unitsRequested, 0);
  const totalApproved = request.items.reduce((sum, i) => sum + i.unitsApproved, 0);

  const canReview = ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status);
  const canMarkReady =
    ['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) && totalApproved > 0;
  const canCreateShipment = request.status === 'READY_FOR_PICKUP' && !request.shipment;

  return (
    <AppShell
      title={request.requestReference}
      subtitle="BLOOD REQUEST DETAILS"
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <button
        onClick={() => router.push('/requests')}
        className="mb-4 flex items-center gap-2 text-sm text-donor-muted hover:text-donor-text"
      >
        <ArrowLeft size={16} />
        Back to Blood Requests
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {request.requestReference}
            </h1>
            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-donor-muted">
            From {request.requestingOrganization.name} — {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {request.shipment && (
            <a
              href={`/shipments/${request.shipment.id}`}
              className="flex items-center gap-2 rounded-lg border border-donor-border px-4 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
            >
              <Truck size={16} />
              View Shipment
            </a>
          )}
          {canReview && (
            <button
              onClick={openReviewModal}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
            >
              <CheckCircle size={16} />
              Review Request
            </button>
          )}
          {canMarkReady && (
            <button
              onClick={handleMarkReady}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {actionLoading ? 'Working...' : 'Mark Ready for Pickup'}
            </button>
          )}
          {canCreateShipment && (
            <button
              onClick={handleCreateShipment}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
            >
              <Truck size={16} />
              {actionLoading ? 'Creating...' : 'Create Shipment'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-4 py-3 text-sm text-donor-onDangerMuted">
          <AlertCircle size={16} />
          {actionError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Requested Units</h3>
            <div className="space-y-3">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-donor-border/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Droplet size={18} className="text-donor-primary" />
                    <span className="text-sm font-medium text-donor-text">
                      {item.bloodType}
                      {item.rhFactor === 'POSITIVE' ? '+' : item.rhFactor === 'NEGATIVE' ? '-' : ''}
                      {' '}
                      {item.componentType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-donor-muted">Requested: <span className="text-donor-text">{item.unitsRequested}</span></span>
                    <span className="text-donor-muted">Approved: <span className="text-donor-text">{item.unitsApproved}</span></span>
                    <span className="text-donor-muted">Fulfilled: <span className="text-donor-text">{item.unitsFulfilled}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-6 text-sm text-donor-muted">
              <span>Total requested: <span className="font-semibold text-donor-text">{totalRequested}</span></span>
              <span>Total approved: <span className="font-semibold text-donor-text">{totalApproved}</span></span>
            </div>
          </div>

          {request.events && request.events.length > 0 && (
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">History</h3>
              <div className="space-y-4">
                {request.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-donor-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-donor-text">{event.eventType.replace(/_/g, ' ')}</p>
                        <span className="text-xs text-donor-muted">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-donor-muted">Requesting Hospital</p>
                <p className="text-donor-text">{request.requestingOrganization.name}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Priority</p>
                <p className="text-donor-text">{request.priority}</p>
              </div>
              {request.expectedDeliveryDate && (
                <div>
                  <p className="text-xs text-donor-muted">Needed By</p>
                  <p className="text-donor-text">{new Date(request.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
              )}
              {request.deliveryAddress && (
                <div>
                  <p className="text-xs text-donor-muted">Delivery Address</p>
                  <p className="text-donor-text">{request.deliveryAddress}</p>
                </div>
              )}
              {request.deliveryPhone && (
                <div>
                  <p className="text-xs text-donor-muted">Delivery Phone</p>
                  <p className="text-donor-text">{request.deliveryPhone}</p>
                </div>
              )}
              {request.notes && (
                <div>
                  <p className="text-xs text-donor-muted">Notes</p>
                  <p className="whitespace-pre-wrap text-donor-text">{request.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 text-xs text-donor-muted">
                <Clock size={12} />
                Submitted {new Date(request.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bc-glass rounded-card p-6">
            <h3 className="mb-1 font-display text-lg font-semibold text-donor-text">Review Request</h3>
            <p className="mb-4 text-sm text-donor-muted">
              Set how many units of each type you can approve. Approving 0 for every line rejects the request.
            </p>

            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {request.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-donor-border/60 px-3 py-2">
                  <span className="text-sm text-donor-text">
                    {item.bloodType}
                    {item.rhFactor === 'POSITIVE' ? '+' : item.rhFactor === 'NEGATIVE' ? '-' : ''}
                    {' '}
                    {item.componentType.replace('_', ' ')}
                    <span className="ml-2 text-xs text-donor-muted">requested {item.unitsRequested}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={item.unitsRequested}
                    value={approvals[item.id] ?? 0}
                    onChange={(e) =>
                      setApprovals((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Math.min(item.unitsRequested, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-20 rounded-lg border border-donor-border bc-solid px-2 py-1 text-sm text-donor-text"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs text-donor-muted">Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              />
            </div>

            {actionError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-3 py-2 text-xs text-donor-onDangerMuted">
                <AlertCircle size={14} />
                {actionError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={actionLoading}
                className="rounded-lg border border-donor-border px-4 py-2 text-sm text-donor-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitReview('reject')}
                disabled={actionLoading}
                className="rounded-lg border border-donor-danger/50 bg-donor-dangerMuted px-4 py-2 text-sm font-semibold text-donor-onDangerMuted transition-colors hover:bg-donor-dangerMuted/70 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => submitReview('approve')}
                disabled={actionLoading}
                className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
