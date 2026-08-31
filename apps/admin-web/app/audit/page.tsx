'use client';

import { useEffect, useState } from 'react';
import { Search, FileText, User, Clock, X, LayoutDashboard, Users, Building2, Ship, Package, Droplet, AlertTriangle, TestTube, Bell, Activity, Settings } from 'lucide-react';
import { LoadingState } from '@bloodchain/ui/components';
import { listAuditLogs, type AuditLog } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { AppShell } from '../../components/AppShell';

export default function AuditLogsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadLogs();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadLogs(page = 1) {
    try {
      const data = await listAuditLogs({
        page,
        limit: 50,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
      });
      setLogs(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadLogs(1);
  }

  if (isLoading) {
    return (
      <AppShell title="Audit Logs" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Audit Logs" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">Platform activity and security events</p>
        </div>

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40">
            <form onSubmit={handleSearch} className="flex gap-4">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">All Actions</option>
                <option value="USER_SUSPENDED">User Suspended</option>
                <option value="USER_RESTORED">User Restored</option>
                <option value="ORGANIZATION_VERIFIED">Organization Verified</option>
                <option value="ORGANIZATION_REJECTED">Organization Rejected</option>
                <option value="ORGANIZATION_SUSPENDED">Organization Suspended</option>
                <option value="COURIER_SUSPENDED">Courier Suspended</option>
                <option value="ALERT_ACKNOWLEDGED">Alert Acknowledged</option>
              </select>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">All Entities</option>
                <option value="User">User</option>
                <option value="Organization">Organization</option>
                <option value="Courier">Courier</option>
                <option value="InventoryAlert">Alert</option>
              </select>
              <button
                type="submit"
                className="bg-donor-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-primary/85"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Timestamp</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Actor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Action</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Entity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Details</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-donor-muted">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-donor-muted" />
                          <span className="text-sm text-donor-text">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {log.actor ? (
                          <div>
                            <p className="text-sm font-medium text-donor-text">{log.actor.name}</p>
                            <p className="text-xs text-donor-muted">{log.actor.email}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-donor-muted">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-donor-elevated text-donor-text">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-donor-muted">{log.entityType}</span>
                        {log.entityId && (
                          <p className="text-xs text-donor-muted truncate max-w-[100px]">{log.entityId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted max-w-[200px] truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-donor-border/40 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadLogs(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadLogs(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
