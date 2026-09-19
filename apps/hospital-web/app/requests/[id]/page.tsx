'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Droplet, Truck, XCircle } from 'lucide-react';
import { StatusBadge } from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import { getBloodRequest, BloodRequest } from '../../../lib/shipments';
import { AppShell } from '../../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Badge colour per status. The wording is not here on purpose: a label
 * written into a module-level map is fixed in one language, so the words
 * come from `t('status.request.<STATUS>')` at render instead.
 */
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  PARTIALLY_APPROVED: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  READY_FOR_PICKUP: 'warning',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  PARTIALLY_DELIVERED: 'warning',
};

export default function BloodRequestDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<BloodRequest | null>(null);

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
          const hospitalOrg = userData.organizations.find((org) => org.type === 'HOSPITAL');
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
    if (organizationId) loadRequest();
  }, [organizationId, loadRequest]);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Hospital workspace"
        userName={t('ops.common.loadingEllipsis')}
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
        title={t('ops.requests.notFound')}
        subtitle={t('portal.hospital.console')}
        organizationName={user?.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
        organizationType="Hospital workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <XCircle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.requests.notFound')}
          </h2>
          <button
            onClick={() => router.push('/requests')}
            className="mt-4 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white"
          >
            {t('ops.common.backToRequests')}
          </button>
        </div>
      </AppShell>
    );
  }

  const statusVariant = STATUS_VARIANT[request.status] ?? 'default';
  const totalRequested = request.items.reduce((sum, i) => sum + i.unitsRequested, 0);
  const totalApproved = request.items.reduce((sum, i) => sum + i.unitsApproved, 0);

  return (
    <AppShell
      title={request.requestReference}
      subtitle={t('ops.requests.detailsTitle')}
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Hospital Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <button
        onClick={() => router.push('/requests')}
        className="mb-4 flex items-center gap-2 text-sm text-donor-muted hover:text-donor-text"
      >
        <ArrowLeft size={16} />
        {t('ops.common.backToRequests')}
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {request.requestReference}
            </h1>
            <StatusBadge variant={statusVariant}>{t(`status.request.${request.status}`)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-donor-muted">
            Created {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        {request.shipment && (
          <Link
            href={`/shipments/${request.shipment.id}`}
            className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
          >
            <Truck size={16} />
            {t('ops.common.viewShipment')}
          </Link>
        )}
      </div>

      {request.rejectionReason && (
        <div className="mb-6 rounded-card border border-donor-danger/40 bg-donor-dangerMuted p-5">
          <div className="flex items-start gap-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-donor-onDangerMuted" />
            <div>
              <p className="text-sm font-semibold text-donor-onDangerMuted">
                {t('ops.requests.rejected')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-donor-text">
                {request.rejectionReason}
              </p>
              {request.rejectedAt && (
                <p className="mt-2 text-xs text-donor-muted">
                  {new Date(request.rejectedAt).toLocaleString()}
                  {request.fulfillingOrganization
                    ? ` \u00b7 ${request.fulfillingOrganization.name}`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.requests.requestedUnits')}</h3>
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
                      {t(`medical.components.${item.componentType}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-donor-muted">{t('ops.requests.requestedLabel')} <span className="text-donor-text">{item.unitsRequested}</span></span>
                    <span className="text-donor-muted">{t('ops.requests.approvedLabel')} <span className="text-donor-text">{item.unitsApproved}</span></span>
                    <span className="text-donor-muted">{t('ops.requests.fulfilledLabel')} <span className="text-donor-text">{item.unitsFulfilled}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-6 text-sm text-donor-muted">
              <span>{t('ops.requests.totalRequested')} <span className="font-semibold text-donor-text">{totalRequested}</span></span>
              <span>{t('ops.requests.totalApproved')} <span className="font-semibold text-donor-text">{totalApproved}</span></span>
            </div>
          </div>

          {request.events && request.events.length > 0 && (
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('healthTrends.history')}</h3>
              <div className="space-y-4">
                {request.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-donor-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-donor-text">{t(`status.requestEvent.${event.eventType}`)}</p>
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
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('table.details')}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-donor-muted">{t('table.priority')}</p>
                <p className="text-donor-text">{request.priority}</p>
              </div>
              {request.fulfillingOrganization && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.fulfillingCenter')}</p>
                  <p className="text-donor-text">{request.fulfillingOrganization.name}</p>
                </div>
              )}
              {request.expectedDeliveryDate && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.neededBy')}</p>
                  <p className="text-donor-text">{new Date(request.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
              )}
              {request.deliveryAddress && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.deliveryAddress')}</p>
                  <p className="text-donor-text">{request.deliveryAddress}</p>
                </div>
              )}
              {request.deliveryPhone && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.deliveryPhone')}</p>
                  <p className="text-donor-text">{request.deliveryPhone}</p>
                </div>
              )}
              {request.notes && (
                <div>
                  <p className="text-xs text-donor-muted">{t('table.notes')}</p>
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
    </AppShell>
  );
}
