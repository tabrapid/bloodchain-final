'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import { listRoles, listPermissions, updateRolePermissions, type Role, type Permission } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { KeyRound, Lock, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';

function permissionGroup(code: string): string {
  return code.split('.')[0] ?? code;
}

export default function RolesPage() {
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
      <AppShell title="Roles & Permissions" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Roles & Permissions" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage which permissions each role grants. Change a specific user&apos;s role from their
            entry on the Users page.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Permissions</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map((role) => {
                  const isSuperAdmin = role.code === 'SUPER_ADMIN';
                  return (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <KeyRound className="w-4 h-4 text-gray-600" />
                          </div>
                          <span className="font-medium text-gray-900">{role.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xl">
                          {isSuperAdmin ? (
                            <span className="text-sm text-gray-500">All permissions (fixed)</span>
                          ) : role.permissions.length === 0 ? (
                            <span className="text-sm text-gray-400">No permissions granted</span>
                          ) : (
                            role.permissions.map((code) => (
                              <span key={code} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                {code}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                            <Lock className="w-3.5 h-3.5" />
                            Fixed
                          </span>
                        ) : (
                          <button
                            onClick={() => openEditor(role)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Edit permissions
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Edit permissions — {editingRole.code}</h3>
              <button onClick={() => setEditingRole(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {error}
                </div>
              )}
              {Object.entries(groupedPermissions).map(([group, perms]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {group.replace('_', ' ')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {perms.map((perm) => (
                      <label key={perm.code} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(perm.code)}
                          onChange={() => toggleCode(perm.code)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span>
                          <span className="block font-medium">{perm.code}</span>
                          <span className="block text-xs text-gray-500">{perm.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setEditingRole(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
