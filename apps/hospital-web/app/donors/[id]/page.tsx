'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Droplet,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ErrorState, LoadingState, StatCard, StatusBadge } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import { getDonor, type DonorDetail } from '../../../lib/donors';
import { AppShell } from '../../../components/AppShell';
import {
  BloodTypeVerification,
  SOURCE_KEYS,
  formatGroup,
} from '../../../components/BloodTypeVerification';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  DEFERRED: 'warning',
};

const VERIFICATION_VARIANT: Record<string, 'success' | 'warning' | 'default'> = {
  VERIFIED: 'success',
  REQUIRES_REVIEW: 'warning',
  UNVERIFIED: 'default',
};

/**
 * One donor, as the desk needs to see them before a donation.
 *
 * The donors list has been clickable-looking and led nowhere since it shipped:
 * `GET /donors/:id` existed, returned the bare profile, and no page called it.
 * This is that page. It shows identity, whether the person can actually be
 * reached, where the blood group on file came from and who signed it off, and
 * a short donation history -- and stops there. Health results, laboratory
 * values and anything else the donor has not shared with this desk stay out:
 * the server would not return them here and this page does not ask.
 */
export default function DonorDetailPage() {
  const { t, formatDate } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const donorId = params.id;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [donor, setDonor] = useState<DonorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<DonorDetail | null>(null);

  const load = useCallback(async () => {
    if (!donorId) return;
    try {
      setDonor(await getDonor(donorId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ops.common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [donorId, t]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) setUser(await me());
      } catch (err) {
        console.error('Auth check failed:', err);
      }
    }
    void checkAuth();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shellProps = {
    title: donor ? `${donor.user.firstName} ${donor.user.lastName}` : t('ops.donors.title'),
    subtitle: t('ops.donors.detailSubtitle'),
    userName: user ? `${user.firstName} ${user.lastName}` : t('portal.guest'),
  };

  if (isLoading) {
    return (
      <AppShell {...shellProps}>
        <LoadingState />
      </AppShell>
    );
  }

  if (error || !donor) {
    return (
      <AppShell {...shellProps}>
        <ErrorState
          title={t('ops.donors.notFound')}
          description={error ?? t('ops.donors.notFoundHint')}
          onRetry={() => void load()}
          onBack={() => router.push('/donors')}
        />
      </AppShell>
    );
  }

  const group = formatGroup(donor.bloodType, donor.rhFactor);
  const summary = donor.donationSummary;
  const contact = donor.contact;

  return (
    <AppShell {...shellProps}>
      <button
        onClick={() => router.push('/donors')}
        className="mb-4 flex items-center gap-2 text-sm text-donor-muted transition-colors hover:text-donor-text"
      >
        <ArrowLeft size={16} />
        {t('ops.donors.backToDonors')}
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {donor.user.firstName} {donor.user.lastName}
            </h1>
            <StatusBadge variant={STATUS_VARIANT[donor.donorStatus] ?? 'default'}>
              {t(`status.donor.${donor.donorStatus}`)}
            </StatusBadge>
            <StatusBadge variant={VERIFICATION_VARIANT[donor.verificationStatus] ?? 'default'}>
              {t(`status.verification.${donor.verificationStatus}`)}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-donor-muted">
            {t('ops.common.joined')} {formatDate(donor.user.createdAt, 'medium')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setVerifying(donor)}
          className="inline-flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
        >
          <ShieldCheck size={16} />
          {t('ops.donors.verification.action')}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label={t('ops.donors.completedDonations')}
          value={String(summary?.completedCount ?? 0)}
          icon={Droplet}
          variant={summary && summary.completedCount > 0 ? 'success' : 'default'}
        />
        <StatCard
          label={t('ops.donors.totalVolume')}
          value={`${summary?.totalVolumeMl ?? 0} ml`}
          icon={Users}
        />
        <StatCard
          label={t('ops.donors.lastDonation')}
          value={
            summary?.lastDonationAt ? formatDate(summary.lastDonationAt, 'medium') : '—'
          }
          icon={CalendarDays}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="bc-glass rounded-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-donor-text">
              {t('ops.donors.bloodGroupProvenance')}
            </h2>

            <div className="flex flex-wrap items-center gap-4">
              <span className="text-3xl font-bold text-donor-primary">{group ?? '—'}</span>
              <div className="text-sm">
                {donor.bloodTypeVerifiedAt ? (
                  <>
                    <p className="text-donor-text">
                      {t('ops.donors.verification.verifiedOn', {
                        date: formatDate(donor.bloodTypeVerifiedAt, 'medium'),
                      })}
                    </p>
                    <p className="text-donor-muted">
                      {donor.bloodTypeSource
                        ? t(SOURCE_KEYS[donor.bloodTypeSource])
                        : t('ops.common.unknown')}
                      {donor.bloodTypeVerifier
                        ? ` · ${donor.bloodTypeVerifier.firstName} ${donor.bloodTypeVerifier.lastName}`
                        : ''}
                    </p>
                  </>
                ) : (
                  // No verification record means the group on file is the
                  // donor's own answer. Saying so is the difference between a
                  // clinical fact and a form field.
                  <p className="text-donor-onWarningMuted">
                    {t('ops.donors.verification.selfReportedFull')}
                  </p>
                )}
              </div>
            </div>

            {donor.bloodTypeNote && (
              <p className="mt-3 border-t border-donor-border/50 pt-3 text-sm text-donor-muted">
                {donor.bloodTypeNote}
              </p>
            )}
          </section>

          <section className="bc-glass rounded-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-donor-text">
              {t('ops.donors.recentDonations')}
            </h2>
            {donor.recentDonations && donor.recentDonations.length > 0 ? (
              <div className="space-y-2">
                {donor.recentDonations.map((donation) => (
                  <div
                    key={donation.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-donor-border/60 px-4 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-donor-text">
                      {donation.donationReference}
                    </span>
                    <span className="text-donor-muted">{donation.organization.name}</span>
                    <span className="text-donor-text">
                      {donation.completedAt ? formatDate(donation.completedAt, 'medium') : '—'} ·{' '}
                      {donation.volumeMl} ml
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-donor-muted">{t('ops.donors.noDonations')}</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bc-glass rounded-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-donor-text">
              {t('ops.donors.contactDetails')}
            </h2>
            <div className="space-y-3 text-sm">
              <ContactRow
                icon={<Mail size={14} className="text-donor-muted" />}
                value={donor.user.email}
                verified={contact?.emailVerified}
                verifiedLabel={t('ops.donors.verifiedContact')}
                unverifiedLabel={t('ops.donors.unverifiedContact')}
              />
              <ContactRow
                icon={<Phone size={14} className="text-donor-muted" />}
                value={donor.user.phone ?? '—'}
                verified={contact?.phoneVerified}
                verifiedLabel={t('ops.donors.verifiedContact')}
                unverifiedLabel={t('ops.donors.unverifiedContact')}
              />
              {contact && !contact.hasVerifiedContact && (
                // Emergency matching skips donors with no verified channel, so
                // this is an operational fact, not a cosmetic badge.
                <p className="rounded-lg border border-donor-warning/40 bg-donor-warningMuted px-3 py-2 text-xs text-donor-onWarningMuted">
                  {t('ops.donors.noVerifiedContactWarning')}
                </p>
              )}
            </div>
          </section>

          <section className="bc-glass rounded-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-donor-text">{t('table.location')}</h2>
            <p className="flex items-start gap-2 text-sm text-donor-text">
              <MapPin size={14} className="mt-0.5 shrink-0 text-donor-muted" />
              {[donor.region?.nameEn, donor.districtRef?.nameEn, donor.city, donor.district]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
          </section>
        </div>
      </div>

      <BloodTypeVerification
        donor={verifying}
        onClose={() => setVerifying(null)}
        onVerified={() => {
          setVerifying(null);
          void load();
        }}
      />
    </AppShell>
  );
}

function ContactRow({
  icon,
  value,
  verified,
  verifiedLabel,
  unverifiedLabel,
}: {
  icon: React.ReactNode;
  value: string;
  verified?: boolean;
  verifiedLabel: string;
  unverifiedLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-donor-text">{value}</span>
      </span>
      {value !== '—' && (
        <StatusBadge variant={verified ? 'success' : 'default'}>
          {verified ? verifiedLabel : unverifiedLabel}
        </StatusBadge>
      )}
    </div>
  );
}
