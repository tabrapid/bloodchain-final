'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, Mail, Phone, RefreshCw, Truck, Users } from 'lucide-react';
import {
  EmptyState,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import { getCourierRoster, CourierRosterEntry } from '../../lib/couriers';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Badge colour per status. The wording is not here on purpose: a label
 * written into a module-level map is fixed in one language, so the words
 * come from `t('status.courier.<STATUS>')` at render instead.
 */
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  AVAILABLE: 'success',
  BUSY: 'info',
  OFFLINE: 'default',
  SUSPENDED: 'danger',
};

export default function CouriersPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [couriers, setCouriers] = useState<CourierRosterEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCouriers = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const data = await getCourierRoster(organizationId);
      setCouriers(data);
    } catch (err) {
      console.error('Failed to load couriers:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId]);

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
      loadCouriers();
    }
  }, [organizationId, loadCouriers]);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Truck className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title={t('portal.authRequired')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Truck className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('ops.common.signInToCouriers')}
          </p>
        </div>
      </AppShell>
    );
  }

  const availableCount = couriers.filter((c) => c.status === 'AVAILABLE').length;
  const busyCount = couriers.filter((c) => c.status === 'BUSY').length;
  const offlineCount = couriers.filter((c) => c.status === 'OFFLINE' || c.status === 'SUSPENDED').length;

  return (
    <AppShell
      title={t('portal.nav.couriers')}
      subtitle={t('ops.dashboard.bloodCenterOperations')}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            {t('ops.couriers.roster')}
          </h1>
          <p className="text-sm text-donor-muted">
            {t('ops.couriers.rosterSubtitle')}
          </p>
        </div>
        <button
          onClick={loadCouriers}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {t('actions.refresh')}
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 bc-glass rounded-card p-4 text-sm text-donor-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-donor-primary" />
        <p>
          {t('ops.couriers.noInviteYet')}
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label={t('ops.couriers.total')} value={couriers.length.toString()} icon={Users} variant="info" />
        <StatCard label={t('status.courier.AVAILABLE')} value={availableCount.toString()} icon={Truck} variant="success" />
        <StatCard label={t('status.courier.BUSY')} value={busyCount.toString()} icon={Truck} variant="info" />
        <StatCard label={t('ops.couriers.offlineSuspended')} value={offlineCount.toString()} icon={Truck} variant="default" />
      </div>

      {couriers.length === 0 ? (
        <EmptyState
          title={t('ops.couriers.empty')}
          description={t('ops.couriers.emptyHint')}
        />
      ) : (
        <div className="space-y-3">
          {couriers.map((courier) => {
            const statusVariant = STATUS_VARIANT[courier.status] ?? 'default';
            return (
              <div
                key={courier.id}
                className="flex items-center justify-between bc-glass rounded-card p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-donor-primaryMuted p-3">
                    <Truck size={22} className="text-donor-onPrimaryMuted" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-donor-text">
                        {courier.displayName}
                      </h3>
                      <StatusBadge variant={statusVariant}>{t(`status.courier.${courier.status}`)}</StatusBadge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-donor-muted">
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {courier.email}
                      </span>
                      {courier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {courier.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-donor-muted">{t('status.courier.AVAILABLE')}</p>
                    <p className="font-semibold text-donor-text">{courier.activeShipments}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-donor-muted">{t('status.shipment.DELIVERED')}</p>
                    <p className="font-semibold text-donor-text">{courier.completedShipments}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
