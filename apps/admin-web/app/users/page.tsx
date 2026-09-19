'use client';

import { useEffect, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { ConfirmDialog, LoadingState } from '@bloodchain/ui/components';
import { listUsers, suspendUser, restoreUser, listRoles, updateMembershipRole, type User as UserType, type Role } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function UsersPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserType[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // `confirm()` said nothing about who was about to lose access.
  const [suspending, setSuspending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleChangeTarget, setRoleChangeTarget] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await Promise.all([loadUsers(), listRoles().then(setRoles)]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadUsers(page = 1) {
    try {
      const data = await listUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadUsers(1);
  }

  async function handleSuspend(userId: string) {
    setActionLoading(true);
    try {
      await suspendUser(userId, 'Suspended by admin');
      await loadUsers(meta.page);
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore(userId: string) {
    setActionLoading(true);
    try {
      await restoreUser(userId);
      await loadUsers(meta.page);
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChangeRole(membershipId: string) {
    const roleId = roleChangeTarget[membershipId];
    if (!roleId) return;
    setActionLoading(true);
    try {
      await updateMembershipRole(membershipId, roleId);
      await loadUsers(meta.page);
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.users.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.users.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">{t('ops.users.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-donor-onDangerMuted">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-donor-onDangerMuted" />
            </button>
          </div>
        )}

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-donor-muted" />
                <input
                  type="text"
                  placeholder={t('ops.users.searchByNameEmailPhone')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bc-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('ops.common.allStatus')}</option>
                <option value="ACTIVE">{t('status.user.ACTIVE')}</option>
                <option value="SUSPENDED">{t('status.user.SUSPENDED')}</option>
                <option value="PENDING_VERIFICATION">{t('status.user.PENDING_VERIFICATION')}</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('filters.allRoles')}</option>
                <option value="DONOR">{t('table.donor')}</option>
                <option value="HOSPITAL_ADMIN">{t('ops.roles.hospitalAdmin')}</option>
                <option value="BLOOD_CENTER_ADMIN">{t('ops.roles.bloodCenterAdmin')}</option>
                <option value="COURIER">{t('table.courier')}</option>
                <option value="SUPER_ADMIN">{t('ops.roles.superAdmin')}</option>
              </select>
              <button
                type="submit"
                className="bg-donor-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-primary/85"
              >
                {t('actions.search')}
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.user')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.common.roles')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.organization')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('home.bloodTypeLabel')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.created')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-donor-muted">
                      {t('ops.users.empty')}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-donor-text">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-donor-muted">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={user.status} domain="user" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((r, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-donor-elevated text-donor-text">
                              {r.role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {user.roles[0]?.organization?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {user.bloodType ? `${user.bloodType}${user.rhFactor}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-donor-primary hover:text-donor-primary/70 text-sm font-medium"
                        >
                          {t('actions.view')}
                        </button>
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
                  onClick={() => loadUsers(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => loadUsers(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bc-glass-elevated bc-rise rounded-panel w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-donor-border/40 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-donor-text">{t('ops.users.details')}</h3>
              <button onClick={() => setSelectedUser(null)}>
                <X className="w-5 h-5 text-donor-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-donor-elevated rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-donor-muted" />
                </div>
                <div>
                  <p className="font-semibold text-donor-text">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-sm text-donor-muted">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-donor-muted">{t('table.status')}</p>
                  <StatusBadgeWrapper status={selectedUser.status} domain="user" />
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('table.phone')}</p>
                  <p className="text-sm font-medium text-donor-text">{selectedUser.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('home.bloodTypeLabel')}</p>
                  <p className="text-sm font-medium text-donor-text">
                    {selectedUser.bloodType ? `${selectedUser.bloodType}${selectedUser.rhFactor}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('ops.users.lastLogin')}</p>
                  <p className="text-sm font-medium text-donor-text">
                    {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-donor-muted mb-2">{t('ops.common.roles')}</p>
                <div className="space-y-2">
                  {selectedUser.roles.map((r) => (
                    <div key={r.membershipId} className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-donor-elevated text-donor-text">
                        {r.role} - {r.organization?.name}
                      </span>
                      <select
                        value={roleChangeTarget[r.membershipId] ?? ''}
                        onChange={(e) =>
                          setRoleChangeTarget((prev) => ({ ...prev, [r.membershipId]: e.target.value }))
                        }
                        className="bc-solid rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-donor-primary"
                      >
                        <option value="">{t('ops.users.changeRoleTo')}</option>
                        {roles
                          .filter((role) => role.code !== r.role)
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.code}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleChangeRole(r.membershipId)}
                        disabled={actionLoading || !roleChangeTarget[r.membershipId]}
                        className="text-xs font-medium text-donor-primary hover:text-donor-primary/70 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('community.postTypes.update')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-donor-border/40 flex gap-3">
              {selectedUser.status === 'SUSPENDED' ? (
                <button
                  onClick={() => handleRestore(selectedUser.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-success text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-success/85 disabled:opacity-50"
                >
                  {actionLoading ? t('ops.common.restoring') : t('ops.users.restoreUser')}
                </button>
              ) : (
                <button
                  onClick={() => setSuspending(selectedUser.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
                >
                  {actionLoading ? t('ops.common.suspending') : t('ops.users.suspendUser')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={() => {
          const id = suspending;
          if (!id) return;
          setSuspending(null);
          void handleSuspend(id);
        }}
        tone="danger"
        title={t('ops.users.suspendTitle')}
        body={t('ops.users.suspendBody')}
        context={
          selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName} · ${selectedUser.email}` : null
        }
        confirmLabel={t('actions.suspend')}
        loading={actionLoading}
      />
    </AppShell>
  );
}
