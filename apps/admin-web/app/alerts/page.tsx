'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { LoadingState } from '@bloodchain/ui/components';
import { listAlerts, acknowledgeAlert } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import {  } from '@lib/status';
import { AppShell } from '../../components/AppShell';

export default function AlertsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [acknowledgedFilter, setAcknowledgedFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadAlerts();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadAlerts(page = 1, acknowledged = acknowledgedFilter) {
    try {
      const data = await listAlerts({
        page,
        limit: 50,
        acknowledged: acknowledged || undefined,
      });
      setAlerts(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  }

  async function handleAcknowledge(alertId: string) {
    setActionLoading(alertId);
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts(meta.page);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Alert Center" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Alert Center" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">Manage platform alerts and notifications</p>
        </div>

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40">
            <select
              value={acknowledgedFilter}
              onChange={(e) => {
                setAcknowledgedFilter(e.target.value);
                loadAlerts(1, e.target.value);
              }}
              className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
            >
              <option value="">All Alerts</option>
              <option value="false">Active</option>
              <option value="true">Acknowledged</option>
            </select>
          </div>

          <div className="divide-y divide-donor-border/40">
            {alerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-donor-success mx-auto mb-4" />
                <p className="text-sm text-donor-muted">No alerts to display</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      alert.type === 'LOW_STOCK' ? 'bg-donor-warningMuted' :
                      alert.type === 'EXPIRING_SOON' ? 'bg-donor-warningMuted' :
                      'bg-donor-secondaryMuted'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.type === 'LOW_STOCK' ? 'text-donor-warning' :
                        alert.type === 'EXPIRING_SOON' ? 'text-donor-warning' :
                        'text-donor-secondary'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-donor-text">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-donor-muted">{alert.type}</span>
                        {alert.bloodType && (
                          <>
                            <span className="text-xs text-donor-muted">-</span>
                            <span className="text-xs text-donor-muted">{alert.bloodType}{alert.rhFactor}</span>
                          </>
                        )}
                        {alert.organization && (
                          <>
                            <span className="text-xs text-donor-muted">-</span>
                            <span className="text-xs text-donor-muted">{alert.organization.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-donor-muted">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                    {alert.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-donor-success">
                        <CheckCircle className="w-4 h-4" />
                        Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={actionLoading === alert.id}
                        className="text-xs bg-donor-primary text-white px-3 py-1 rounded hover:bg-donor-primary/85 disabled:opacity-50"
                      >
                        {actionLoading === alert.id ? '...' : 'Acknowledge'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
