'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@bloodchain/ui/components';
import {
  listOrganizations,
  verifyOrganization,
  rejectOrganization,
  suspendOrganization,
  restoreOrganization,
  getDirectoryEntry,
  setDirectoryVerification,
  geoName,
  type DirectoryOrganization,
  type Organization,
} from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { Building2, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function OrganizationsPage() {
  const { t, locale } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [directory, setDirectory] = useState<DirectoryOrganization | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadOrgs();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadOrgs(page = 1) {
    try {
      const data = await listOrganizations({
        page,
        limit: 20,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setOrganizations(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadOrgs(1);
  }

  async function handleVerify(id: string) {
    if (!confirm('Are you sure you want to verify this organization?')) return;
    setActionLoading(true);
    try {
      await verifyOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
      setDirectory(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  /**
   * Directory verification, which is not the same thing as `handleVerify`.
   *
   * That one approves a pending *registration* and moves the organization to
   * ACTIVE. This is the directory's trust badge: a platform administrator
   * saying the entry donors are about to travel to describes a real place.
   */
  async function handleDirectoryVerification(verified: boolean) {
    if (!directory) return;
    setActionLoading(true);
    setError(null);
    try {
      setDirectory(await setDirectoryVerification(directory.id, verified));
    } catch (err: any) {
      setError(err.message ?? t('directory.verificationFailed'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await rejectOrganization(id, reason);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
      setDirectory(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSuspend(id: string) {
    if (!confirm('Are you sure you want to suspend this organization?')) return;
    setActionLoading(true);
    try {
      await suspendOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
      setDirectory(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore(id: string) {
    setActionLoading(true);
    try {
      await restoreOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
      setDirectory(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.organizations.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('ops.organizations.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">{t('ops.organizations.subtitle')}</p>
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
                  placeholder={t('ops.organizations.searchByNameEmailAddress')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bc-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('filters.allTypes')}</option>
                <option value="HOSPITAL">{t('table.hospital')}</option>
                <option value="BLOOD_CENTER">{t('table.bloodCenter')}</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">{t('ops.common.allStatus')}</option>
                <option value="ACTIVE">{t('status.organization.ACTIVE')}</option>
                <option value="PENDING_APPROVAL">{t('status.organization.PENDING_APPROVAL')}</option>
                <option value="SUSPENDED">{t('status.organization.SUSPENDED')}</option>
                <option value="DEACTIVATED">{t('status.organization.DEACTIVATED')}</option>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.organization')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.type')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('ops.organizations.staff')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.created')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-donor-muted">
                      {t('ops.organizations.empty')}
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-donor-elevated rounded flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-donor-muted" />
                          </div>
                          <div>
                            <p className="font-medium text-donor-text">{org.name}</p>
                            <p className="text-sm text-donor-muted">{org.address || 'No address'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-donor-secondaryMuted text-donor-onSecondaryMuted">
                          {org.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={org.status} domain="organization" />
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {org.staffCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            const data = await import('@lib/api').then(m => m.getOrganization(org.id));
                            // The directory entry is a separate read: the
                            // admin detail endpoint has its own projection
                            // and does not carry the geography fields.
                            getDirectoryEntry(org.id)
                              .then(setDirectory)
                              .catch(() => setDirectory(null));
                            setSelectedOrg(data);
                          }}
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
                  onClick={() => loadOrgs(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => loadOrgs(meta.page + 1)}
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

      {selectedOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bc-glass-elevated bc-rise rounded-panel w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-donor-border/40 flex items-center justify-between sticky top-0 bc-solid">
              <h3 className="text-lg font-semibold text-donor-text">{t('ops.organizations.details')}</h3>
              <button onClick={() => { setSelectedOrg(null); setDirectory(null); }}>
                <X className="w-5 h-5 text-donor-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-donor-secondaryMuted rounded-full flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-donor-onSecondaryMuted" />
                </div>
                <div>
                  <p className="font-semibold text-donor-text">{selectedOrg.name}</p>
                  <p className="text-sm text-donor-muted">{selectedOrg.type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-donor-muted">{t('table.status')}</p>
                  <StatusBadgeWrapper status={selectedOrg.status} domain="organization" />
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('ops.organizations.staffCount')}</p>
                  <p className="text-sm font-medium text-donor-text">{selectedOrg.staffCount || selectedOrg.staff?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('table.email')}</p>
                  <p className="text-sm font-medium text-donor-text">{selectedOrg.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-donor-muted">{t('table.phone')}</p>
                  <p className="text-sm font-medium text-donor-text">{selectedOrg.phone || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-donor-muted mb-1">{t('table.address')}</p>
                <p className="text-sm font-medium text-donor-text">{selectedOrg.address || '-'}</p>
              </div>

              {directory && (
                <div className="border-t border-donor-border/40 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-donor-text">{t('directory.entry')}</p>
                    <div className="flex items-center gap-2">
                      {directory.isDemo && (
                        <span className="rounded-full bg-donor-warningMuted px-2 py-0.5 text-xs font-semibold text-donor-onWarningMuted">
                          {t('directory.demo')}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          directory.isVerified
                            ? 'bg-donor-successMuted text-donor-onSuccessMuted'
                            : 'bc-solid text-donor-muted'
                        }`}
                      >
                        {directory.isVerified && <ShieldCheck className="w-3 h-3" />}
                        {directory.isVerified ? t('directory.verified') : t('directory.notVerified')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-donor-muted">{t('directory.region')}</p>
                      <p className="font-medium text-donor-text">
                        {directory.region ? geoName(directory.region, locale) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-donor-muted">{t('directory.district')}</p>
                      <p className="font-medium text-donor-text">
                        {directory.district ? geoName(directory.district, locale) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-donor-muted">{t('directory.publicPhone')}</p>
                      <p className="font-medium text-donor-text">{directory.publicPhone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-donor-muted">{t('directory.coordinates')}</p>
                      <p className="flex items-center gap-1 font-medium text-donor-text">
                        {directory.latitude !== null && directory.longitude !== null ? (
                          <>
                            <MapPin className="w-3 h-3 text-donor-muted" />
                            {`${directory.latitude}, ${directory.longitude}`}
                          </>
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {directory.acceptsDonations && (
                      <span className="rounded-full bc-solid px-2 py-0.5 text-xs text-donor-text">
                        {t('directory.acceptsDonations')}
                      </span>
                    )}
                    {directory.providesLaboratory && (
                      <span className="rounded-full bc-solid px-2 py-0.5 text-xs text-donor-text">
                        {t('directory.providesLaboratory')}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-donor-muted mb-1">{t('directory.services')}</p>
                    {directory.services.length === 0 ? (
                      <p className="text-sm text-donor-muted">-</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {directory.services.map((entry) => (
                          <span
                            key={entry.service}
                            className="rounded-full bg-donor-elevated px-2 py-0.5 text-xs text-donor-text"
                          >
                            {t(`medical.services.${entry.service}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-donor-muted">{t('directory.verifiedHint')}</p>
                  <button
                    onClick={() => handleDirectoryVerification(!directory.isVerified)}
                    disabled={actionLoading}
                    className="w-full rounded-lg bc-solid py-2 px-4 text-sm font-medium text-donor-text hover:bg-donor-elevated disabled:opacity-50"
                  >
                    {directory.isVerified
                      ? t('directory.withdrawVerification')
                      : t('directory.markVerified')}
                  </button>
                </div>
              )}

              {selectedOrg.stats && (
                <div className="border-t border-donor-border/40 pt-4">
                  <p className="text-sm font-medium text-donor-text mb-2">{t('ops.organizations.statistics')}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-donor-elevated p-2 rounded-card">
                      <p className="text-donor-muted">{t('ops.requests.title')}</p>
                      <p className="font-medium">{selectedOrg.stats.bloodRequestsReceived || 0}</p>
                    </div>
                    <div className="bg-donor-elevated p-2 rounded-card">
                      <p className="text-donor-muted">{t('ops.shipments.title')}</p>
                      <p className="font-medium">{selectedOrg.stats.shipmentsCreated || 0}</p>
                    </div>
                    <div className="bg-donor-elevated p-2 rounded-card">
                      <p className="text-donor-muted">{t('portal.nav.couriers')}</p>
                      <p className="font-medium">{selectedOrg.stats.couriers || 0}</p>
                    </div>
                    <div className="bg-donor-elevated p-2 rounded-card">
                      <p className="text-donor-muted">{t('ops.requests.fulfilled')}</p>
                      <p className="font-medium">{selectedOrg.stats.bloodRequestsFulfilled || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-donor-border/40 flex gap-3">
              {selectedOrg.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    onClick={() => handleVerify(selectedOrg.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-donor-success text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-success/85 disabled:opacity-50"
                  >
                    {actionLoading ? t('ops.common.loadingEllipsis') : t('actions.verify')}
                  </button>
                  <button
                    onClick={() => handleReject(selectedOrg.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-donor-muted text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-muted/85 disabled:opacity-50"
                  >
                    {t('actions.reject')}
                  </button>
                </>
              )}
              {selectedOrg.status === 'ACTIVE' && (
                <button
                  onClick={() => handleSuspend(selectedOrg.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
                >
                  {actionLoading ? t('ops.common.loadingEllipsis') : t('actions.suspend')}
                </button>
              )}
              {selectedOrg.status === 'SUSPENDED' && (
                <button
                  onClick={() => handleRestore(selectedOrg.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-success text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-success/85 disabled:opacity-50"
                >
                  {actionLoading ? t('ops.common.loadingEllipsis') : t('actions.restore')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
