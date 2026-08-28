'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, Droplet, RefreshCw, Truck } from 'lucide-react';
import {
  EmptyState,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import { getBloodRequests, BloodRequest } from '../../lib/shipments';
import { AppShell } from '../../components/AppShell';

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

const PRIORITY_COLOR: Record<string, string> = {
  ROUTINE: 'text-blue-400',
  URGENT: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

export default function BloodRequestsPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const filters: { status?: string; type?: string } = { type: 'fulfilling' };
      if (statusFilter) filters.status = statusFilter;
      const data = await getBloodRequests(organizationId, filters);
      setRequests(data.data);
    } catch (err) {
      console.error('Failed to load blood requests:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, statusFilter]);

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
      loadRequests();
    }
  }, [organizationId, loadRequests]);

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

  if (!user) {
    return (
      <AppShell
        title="Authentication Required"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <Droplet className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access blood requests
          </p>
        </div>
      </AppShell>
    );
  }

  const pendingCount = requests.filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length;
  const readyCount = requests.filter((r) => r.status === 'READY_FOR_PICKUP').length;
  const inTransitCount = requests.filter((r) => r.status === 'IN_TRANSIT').length;
  const deliveredCount = requests.filter((r) => ['DELIVERED', 'PARTIALLY_DELIVERED'].includes(r.status)).length;

  return (
    <AppShell
      title="Blood Requests"
      subtitle="BLOOD CENTER OPERATIONS"
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              Incoming Blood Requests
            </h1>
            <p className="text-sm text-donor-muted">
              Review and fulfill blood requests submitted by hospitals
            </p>
          </div>
          <button
            onClick={loadRequests}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PARTIALLY_APPROVED">Partially Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="READY_FOR_PICKUP">Ready for Pickup</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Needs Review"
          value={pendingCount.toString()}
          icon={Clock}
          variant={pendingCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Ready for Pickup"
          value={readyCount.toString()}
          icon={CheckCircle}
          variant={readyCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="In Transit"
          value={inTransitCount.toString()}
          icon={Truck}
          variant="info"
        />
        <StatCard
          label="Delivered"
          value={deliveredCount.toString()}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No incoming blood requests"
          description="Requests submitted by hospitals will appear here for review."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const status = STATUS_CONFIG[request.status] || {
              label: request.status,
              variant: 'default' as const,
            };
            const totalRequested = request.items.reduce((sum, i) => sum + i.unitsRequested, 0);
            const needsReview = ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status);
            return (
              <a
                key={request.id}
                href={`/requests/${request.id}`}
                className="block rounded-xl border border-donor-border bg-donor-surface p-5 transition-colors hover:bg-donor-border/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-donor-primary/20 p-3">
                      <Droplet size={24} className="text-donor-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg font-semibold text-donor-text">
                          {request.requestReference}
                        </h3>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                        <span className={`text-xs font-semibold uppercase ${PRIORITY_COLOR[request.priority] || 'text-donor-muted'}`}>
                          {request.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-donor-muted">
                        From {request.requestingOrganization.name}
                        {' — '}
                        {request.items.map((i) => `${i.bloodType}${i.rhFactor === 'POSITIVE' ? '+' : i.rhFactor === 'NEGATIVE' ? '-' : ''} ${i.componentType.replace('_', ' ')}`).join(', ')}
                        {' — '}
                        {totalRequested} unit{totalRequested !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-donor-muted">
                        <Clock size={12} />
                        {new Date(request.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {needsReview && (
                    <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-400">
                      Needs Review
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
