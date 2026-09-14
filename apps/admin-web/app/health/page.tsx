'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { getSystemHealth, getDashboard } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import {  } from '@lib/status';
import { AlertTriangle, CheckCircle, XCircle, Server, RefreshCw, Database } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function SystemHealthPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadData();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadData() {
    try {
      const [healthData, statsData] = await Promise.all([
        getSystemHealth(),
        getDashboard(),
      ]);
      setHealth(healthData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load system health:', err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (isLoading) {
    return (
      <AppShell title={t('portal.nav.health')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('portal.nav.health')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-donor-muted">{t('ops.health.subtitle')}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-donor-elevated text-donor-text px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-border/60 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                health?.status === 'healthy' ? 'bg-donor-successMuted' : 'bg-donor-dangerMuted'
              }`}>
                {health?.status === 'healthy' ? (
                  <CheckCircle className="w-6 h-6 text-donor-onSuccessMuted" />
                ) : (
                  <XCircle className="w-6 h-6 text-donor-onDangerMuted" />
                )}
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.health.overallStatus')}</p>
                <p className="text-xl font-semibold text-donor-text capitalize">{health?.status || 'Unknown'}</p>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                health?.database === 'up' ? 'bg-donor-successMuted' : 'bg-donor-dangerMuted'
              }`}>
                <Database className={`w-6 h-6 ${health?.database === 'up' ? 'text-donor-onSuccessMuted' : 'text-donor-onDangerMuted'}`} />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.dashboard.database')}</p>
                <p className="text-xl font-semibold text-donor-text capitalize">{health?.database || 'Unknown'}</p>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-donor-secondaryMuted">
                <Server className="w-6 h-6 text-donor-onSecondaryMuted" />
              </div>
              <div>
                <p className="text-sm text-donor-muted">{t('ops.health.lastUpdated')}</p>
                <p className="text-sm font-semibold text-donor-text">
                  {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.health.pendingItems')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-donor-warningMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-donor-onWarningMuted" />
                  <span className="text-sm text-donor-text">{t('ops.dashboard.pendingOrganizations')}</span>
                </div>
                <span className="font-semibold text-donor-text">{health?.pending?.organizations || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-secondaryMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-donor-onSecondaryMuted" />
                  <span className="text-sm text-donor-text">{t('ops.health.pendingCouriers')}</span>
                </div>
                <span className="font-semibold text-donor-text">{health?.pending?.couriers || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-donor-dangerMuted rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-donor-onDangerMuted" />
                  <span className="text-sm text-donor-text">{t('ops.dashboard.activeAlerts')}</span>
                </div>
                <span className="font-semibold text-donor-text">{health?.alerts || 0}</span>
              </div>
            </div>
          </div>

          <div className="bc-glass rounded-card p-6">
            <h3 className="font-medium text-donor-text mb-4">{t('ops.health.recentErrors')}</h3>
            <div className="flex items-center justify-between p-3 bg-donor-dangerMuted rounded-lg">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-donor-onDangerMuted" />
                <span className="text-sm text-donor-text">Failed Jobs (24h)</span>
              </div>
              <span className="font-semibold text-donor-text">{health?.recentErrors || 0}</span>
            </div>
          </div>
        </div>

        <div className="bc-glass rounded-card p-6">
          <h3 className="font-medium text-donor-text mb-4">{t('ops.health.platformSummary')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.dashboard.totalUsers')}</p>
              <p className="text-xl font-semibold text-donor-text">{stats?.users?.total || 0}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.dashboard.activeShipments')}</p>
              <p className="text-xl font-semibold text-donor-text">{stats?.shipments?.active || 0}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.dashboard.activeEmergencies')}</p>
              <p className="text-xl font-semibold text-donor-text">{stats?.emergencies?.active || 0}</p>
            </div>
            <div className="p-4 bg-donor-elevated rounded-lg">
              <p className="text-sm text-donor-muted">{t('ops.health.criticalRequests')}</p>
              <p className="text-xl font-semibold text-donor-text">{stats?.bloodRequests?.critical || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
