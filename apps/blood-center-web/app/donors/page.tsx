'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Search, ShieldCheck, Users } from 'lucide-react';
import {
  DataTable,
  DataTableColumn,
  EmptyState,
  ErrorState,
  StatusBadge,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import { listDonors, Donor, ListDonorsParams, VerificationStatus } from '../../lib/donors';
import { AppShell } from '../../components/AppShell';
import { BloodTypeVerification, formatGroup } from '../../components/BloodTypeVerification';
import { useTranslation } from '@bloodchain/ui/i18n';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const DONOR_STATUSES = ['ACTIVE', 'INACTIVE', 'DEFERRED'] as const;
const VERIFICATION_STATUSES: VerificationStatus[] = ['UNVERIFIED', 'REQUIRES_REVIEW', 'VERIFIED'];

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

function statusVariant(status: string): StatusVariant {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'INACTIVE': return 'default';
    case 'DEFERRED': return 'danger';
    default: return 'default';
  }
}

function verificationVariant(status: string): StatusVariant {
  switch (status) {
    case 'VERIFIED': return 'success';
    case 'REQUIRES_REVIEW': return 'warning';
    case 'UNVERIFIED': return 'default';
    default: return 'default';
  }
}

export default function DonorsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [donors, setDonors] = useState<Donor[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<ListDonorsParams>({ page: 1, limit: 20 });
  const [cityInput, setCityInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // The donor whose blood group is open for verification; null when none is.
  const [verifying, setVerifying] = useState<Donor | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDonors, setTotalDonors] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          setUser(await me());
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const loadDonors = useCallback(async () => {
    setIsLoadingData(true);
    setLoadError(false);
    try {
      const response = await listDonors(filters);
      setDonors(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalDonors(response.meta.total);
    } catch (err) {
      console.error('Failed to load donors:', err);
      setLoadError(true);
    } finally {
      setIsLoadingData(false);
    }
  }, [filters]);

  useEffect(() => {
    if (user) loadDonors();
  }, [user, loadDonors]);

  const handleCitySearch = () => {
    setFilters((prev) => ({ ...prev, city: cityInput || undefined, page: 1 }));
  };

  const handleDonorSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput.trim() || undefined, page: 1 }));
  };

  // The server returns the updated profile, so the row can be corrected without
  // a round trip -- and without guessing what the server decided.
  const handleVerified = (updated: Donor) => {
    setDonors((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  };

  const handleFilterChange = (key: keyof ListDonorsParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const columns: DataTableColumn<Donor>[] = [
    { key: 'name', header: t('table.name'), render: (d) => `${d.user.firstName} ${d.user.lastName}` },
    { key: 'email', header: t('table.email'), render: (d) => d.user.email },
    {
      key: 'bloodType',
      header: t('home.bloodTypeLabel'),
      render: (d) => {
        const group = formatGroup(d.bloodType, d.rhFactor);
        if (!group) return '—';
        return (
          <span>
            <span className="font-semibold">{group}</span>
            {d.verificationStatus !== 'VERIFIED' && (
              <span className="ml-2 text-xs text-donor-muted">
                {t('ops.donors.verification.selfReported')}
              </span>
            )}
          </span>
        );
      },
    },
    { key: 'location', header: t('table.location'), render: (d) => [d.city, d.district].filter(Boolean).join(', ') || '—' },
    { key: 'donorStatus', header: t('table.status'), render: (d) => <StatusBadge variant={statusVariant(d.donorStatus)}>{d.donorStatus}</StatusBadge> },
    { key: 'verificationStatus', header: t('ops.common.verification'), render: (d) => <StatusBadge variant={verificationVariant(d.verificationStatus)}>{d.verificationStatus.replace('_', ' ')}</StatusBadge> },
    { key: 'createdAt', header: t('ops.common.joined'), render: (d) => new Date(d.createdAt).toLocaleDateString() },
    {
      key: 'verify',
      header: '',
      render: (d) => (
        <button
          type="button"
          onClick={() => setVerifying(d)}
          className="inline-flex items-center gap-1.5 rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
        >
          <ShieldCheck size={15} />
          {t('ops.donors.verification.action')}
        </button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="Blood Center Console"
        organizationType="Operations workspace"
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title={t('portal.authRequired')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="Blood Center Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Users className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('ops.common.signInToDonors')}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('portal.nav.donors')}
      subtitle={t('ops.dashboard.bloodCenterOperations')}
      organizationName={user.organizations.find((org) => org.type === 'BLOOD_CENTER' || org.type === 'BLOOD_CENTER_ADMIN')?.name ?? 'Blood Center Console'}
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-donor-text">{t('ops.donors.title')}</h1>
        <p className="text-sm text-donor-muted">
          Browse the platform&apos;s registered donors by blood type, status, and location
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={18} />
          <input
            type="text"
            placeholder={t('ops.donors.searchByNameOrEmail')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDonorSearch()}
            onBlur={handleDonorSearch}
            className="w-full rounded-lg bc-solid px-10 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-secondary focus:outline-none"
          />
        </div>
        <div className="relative min-w-[160px]">
          <input
            type="text"
            placeholder={t('ops.donors.searchByCity')}
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            onBlur={handleCitySearch}
            className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-secondary focus:outline-none"
          />
        </div>
        <select
          value={filters.bloodType ?? ''}
          onChange={(e) => handleFilterChange('bloodType', e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">{t('ops.donors.allBloodTypes')}</option>
          {BLOOD_TYPES.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
        <select
          value={filters.donorStatus ?? ''}
          onChange={(e) => handleFilterChange('donorStatus', e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">{t('filters.allStatuses')}</option>
          {DONOR_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filters.verificationStatus ?? ''}
          onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">{t('ops.donors.allVerificationStates')}</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {isLoadingData ? (
        <DataTable columns={columns} rows={[]} keyExtractor={(d) => d.id} loading />
      ) : loadError ? (
        <ErrorState
          title={t('ops.donors.loadFailed')}
          description={t('ops.donors.loadFailedHint')}
          onRetry={loadDonors}
        />
      ) : donors.length === 0 ? (
        <EmptyState
          title={t('ops.donors.empty')}
          description={t('ops.donors.emptyHint')}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={donors}
            keyExtractor={(d) => d.id}
            // The directory listed donors and led nowhere. A row now opens the
            // record; `userId` rather than `id`, because `GET /donors/:id`
            // takes the user id, not the profile's.
            onRowClick={(d) => router.push(`/donors/${d.userId}`)}
            rowLabel={(d) => `${d.user.firstName} ${d.user.lastName}`}
          />

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {((filters.page ?? 1) - 1) * (filters.limit ?? 20) + 1} to{' '}
                {Math.min((filters.page ?? 1) * (filters.limit ?? 20), totalDonors)} of {totalDonors} donors
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) - 1)}
                  disabled={(filters.page ?? 1) <= 1}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                  disabled={(filters.page ?? 1) >= totalPages}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('actions.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <BloodTypeVerification
        donor={verifying}
        onClose={() => setVerifying(null)}
        onVerified={handleVerified}
      />
    </AppShell>
  );
}
