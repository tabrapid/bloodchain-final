'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Search, Users } from 'lucide-react';
import {
  DataTable,
  DataTableColumn,
  EmptyState,
  ErrorState,
  StatusBadge,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import { listDonors, Donor, ListDonorsParams } from '../../lib/donors';
import { AppShell } from '../../components/AppShell';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const DONOR_STATUSES = ['ACTIVE', 'INACTIVE', 'DEFERRED'] as const;

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
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [donors, setDonors] = useState<Donor[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<ListDonorsParams>({ page: 1, limit: 20 });
  const [cityInput, setCityInput] = useState('');
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

  const handleFilterChange = (key: keyof ListDonorsParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const columns: DataTableColumn<Donor>[] = [
    { key: 'name', header: 'Name', render: (d) => `${d.user.firstName} ${d.user.lastName}` },
    { key: 'email', header: 'Email', render: (d) => d.user.email },
    {
      key: 'bloodType',
      header: 'Blood Type',
      render: (d) => d.bloodType
        ? <span><span className="font-semibold">{d.bloodType}</span><span className="ml-1 text-xs text-donor-muted">{d.rhFactor === 'POSITIVE' ? '+' : d.rhFactor === 'NEGATIVE' ? '-' : ''}</span></span>
        : '—',
    },
    { key: 'location', header: 'Location', render: (d) => [d.city, d.district].filter(Boolean).join(', ') || '—' },
    { key: 'donorStatus', header: 'Status', render: (d) => <StatusBadge variant={statusVariant(d.donorStatus)}>{d.donorStatus}</StatusBadge> },
    { key: 'verificationStatus', header: 'Verification', render: (d) => <StatusBadge variant={verificationVariant(d.verificationStatus)}>{d.verificationStatus.replace('_', ' ')}</StatusBadge> },
    { key: 'createdAt', header: 'Joined', render: (d) => new Date(d.createdAt).toLocaleDateString() },
  ];

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName="Loading..."
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
        title="Authentication Required"
        subtitle="HOSPITAL CONSOLE"
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Users className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to browse the donor directory
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Donors"
      subtitle="HOSPITAL OPERATIONS"
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-donor-text">Donor Directory</h1>
        <p className="text-sm text-donor-muted">
          Browse the platform&apos;s registered donors by blood type, status, and location
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={18} />
          <input
            type="text"
            placeholder="Search by city..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            className="w-full rounded-lg bc-solid px-10 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-secondary focus:outline-none"
          />
        </div>
        <select
          value={filters.bloodType ?? ''}
          onChange={(e) => handleFilterChange('bloodType', e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">All Blood Types</option>
          {BLOOD_TYPES.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
        <select
          value={filters.donorStatus ?? ''}
          onChange={(e) => handleFilterChange('donorStatus', e.target.value)}
          className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
        >
          <option value="">All Statuses</option>
          {DONOR_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoadingData ? (
        <DataTable columns={columns} rows={[]} keyExtractor={(d) => d.id} loading />
      ) : loadError ? (
        <ErrorState
          title="Failed to load donors"
          description="Something went wrong fetching the donor directory. Please try again."
          onRetry={loadDonors}
        />
      ) : donors.length === 0 ? (
        <EmptyState
          title="No donors found"
          description="Try adjusting the blood type, status, or city filters"
        />
      ) : (
        <>
          <DataTable columns={columns} rows={donors} keyExtractor={(d) => d.id} />

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
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                  disabled={(filters.page ?? 1) >= totalPages}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
