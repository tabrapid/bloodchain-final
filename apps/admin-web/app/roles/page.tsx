'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { listRoles, listPermissions, updateRolePermissions, type Role, type Permission } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { ChevronDown, KeyRound, Lock, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';
import { permissionGroup, permissionGroupLabel } from '../../lib/permission-groups';


/**
 * A role's permission list can run to 14+ codes (see BLOOD_CENTER_ADMIN),
 * which as a flat wrapped row of pills reads as noise, not information.
 * Sorting by group clusters `donor.*`/`hospital.*`/etc. together, and
 * collapsing past a threshold keeps a normal row scannable while a click
 * still reveals everything -- no permission is hidden, just deferred.
 */
function PermissionPills({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const sorted = [...codes].sort((a, b) => a.localeCompare(b));
  const visibleCount = 6;
  const visible = expanded ? sorted : sorted.slice(0, visibleCount);
  const remaining = sorted.length - visible.length;

  return (
    <div className="flex max-w-xl flex-wrap items-center gap-1.5">
      {visible.map((code) => (
        <span
          key={code}
          className="inline-flex items-center rounded-full border border-donor-border/60 bg-donor-elevated px-2.5 py-1 text-[11px] font-medium text-donor-text"
          title={code}
        >
          {code}
        </span>
      ))}
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 rounded-full border border-donor-border/60 px-2.5 py-1 text-[11px] font-semibold text-donor-primary hover:bg-donor-elevated"
        >
          +{remaining} more
        </button>
      )}
      {expanded && sorted.length > visibleCount && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-donor-muted hover:text-donor-text"
        >
          <ChevronDown size={12} className="rotate-180" /> {t('ops.roles.showLess')}
        </button>
      )}
    </div>
  );
}

export default function RolesPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const [rolesData, permissionsData] = await Promise.all([listRoles(), listPermissions()]);
    setRoles(rolesData);
    setPermissions(permissionsData);
  }

  function openEditor(role: Role) {
    setEditingRole(role);
    setSelectedCodes(new Set(role.permissions));
    setError(null);
  }

  function toggleCode(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSave() {
    if (!editingRole) return;
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(editingRole.id, Array.from(selectedCodes));
      await loadData();
      setEditingRole(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  }

  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const group = permissionGroup(perm.code);
    (acc[group] ??= []).push(perm);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <AppShell title={t('ops.roles.pageTitle')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.roles.pageTitle')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">{t('ops.roles.manageHint')}</p>
        </div>

        <div className="bc-glass rounded-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th scope="col" className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.role')}</th>
                  <th scope="col" className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.roles.permissions')}</th>
                  <th scope="col" className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {roles.map((role) => {
                  const isSuperAdmin = role.code === 'SUPER_ADMIN';
                  return (
                    <tr key={role.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-donor-elevated rounded flex items-center justify-center">
                            <KeyRound className="w-4 h-4 text-donor-muted" />
                          </div>
                          <span className="font-medium text-donor-text">{role.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <span className="text-sm text-donor-muted">{t('ops.roles.allPermissionsFixed')}</span>
                        ) : role.permissions.length === 0 ? (
                          <span className="text-sm text-donor-muted">{t('ops.roles.noPermissions')}</span>
                        ) : (
                          <PermissionPills codes={role.permissions} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-sm text-donor-muted">
                            <Lock className="w-3.5 h-3.5" />
                            {t('ops.common.fixed')}
                          </span>
                        ) : (
                          <button
                            onClick={() => openEditor(role)}
                            className="text-donor-primary hover:text-donor-primary/70 text-sm font-medium"
                          >
                            {t('ops.roles.editPermissions')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingRole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bc-glass-elevated bc-rise rounded-panel w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-donor-border/40 flex items-center justify-between sticky top-0 bc-solid">
              <h3 className="text-lg font-semibold text-donor-text">Edit permissions — {editingRole.code}</h3>
              <button onClick={() => setEditingRole(null)}>
                <X className="w-5 h-5 text-donor-muted" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg text-sm text-donor-onDangerMuted">
                  {error}
                </div>
              )}
              {Object.entries(groupedPermissions).map(([group, perms]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-donor-muted mb-2">
                    {permissionGroupLabel(t, group)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label key={perm.code} className="flex items-start gap-2 text-sm text-donor-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(perm.code)}
                          onChange={() => toggleCode(perm.code)}
                          className="mt-0.5 h-4 w-4 rounded border-donor-border/80 text-donor-primary focus:ring-donor-primary"
                        />
                        <span>
                          <span className="block font-medium">{perm.code}</span>
                          <span className="block text-xs text-donor-muted">{perm.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-donor-border/40 flex gap-3 sticky bottom-0 bc-solid">
              <button
                onClick={() => setEditingRole(null)}
                className="flex-1 bc-solid text-donor-text py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-elevated"
              >
                {t('actions.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('ops.roles.savePermissions')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
