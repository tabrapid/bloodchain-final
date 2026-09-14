'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle } from 'lucide-react';
import { registerOrganization, ApiRequestError } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function RegisterHospitalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [address, setAddress] = useState('');
  const [organizationPhone, setOrganizationPhone] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await registerOrganization({
        organizationType: 'HOSPITAL',
        organizationName,
        address: address || undefined,
        organizationPhone: organizationPhone || undefined,
        adminFirstName,
        adminLastName,
        adminEmail,
        adminPassword,
        adminPhone: adminPhone || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.error.message : t('ops.register.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppShell
        title={t('ops.register.submitted')}
        subtitle={t('portal.hospital.console')}
        organizationName={organizationName || 'Hospital Console'}
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <CheckCircle className="mb-4 text-donor-success" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.register.submitted')}
          </h2>
          <p className="mb-6 max-w-md text-donor-muted">
            {t('ops.common.check')} <strong>{adminEmail}</strong> to verify your email address. Once verified, your
            hospital account will be reviewed by a BloodChain admin — you&apos;ll be able to
            sign in as soon as it&apos;s approved.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-donor-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-primary/80"
          >
            {t('portal.backToSignIn')}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('ops.register.hospitalTitle')}
      subtitle={t('portal.hospital.console')}
      organizationName={organizationName || 'Hospital Console'}
      organizationType="Operations workspace"
      userName="Guest"
    >
      <div className="mx-auto max-w-lg bc-glass rounded-card p-8">
        <Building2 className="mb-4 text-donor-primary" size={40} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          {t('ops.register.hospitalTitle')}
        </h2>
        <p className="mb-6 text-sm text-donor-muted">
          {t('ops.register.hospitalIntro')}
        </p>

        {error && <p className="mb-4 text-sm text-donor-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-donor-muted">
              {t('ops.register.hospitalDetails')}
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="organizationName" className="mb-1 block text-xs font-medium text-donor-muted">
                  {t('ops.register.hospitalName')}
                </label>
                <input
                  id="organizationName"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <div>
                <label htmlFor="address" className="mb-1 block text-xs font-medium text-donor-muted">
                  {t('table.address')}
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <div>
                <label htmlFor="organizationPhone" className="mb-1 block text-xs font-medium text-donor-muted">
                  {t('table.phone')}
                </label>
                <input
                  id="organizationPhone"
                  type="tel"
                  value={organizationPhone}
                  onChange={(e) => setOrganizationPhone(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-donor-muted">
              {t('ops.register.adminAccount')}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adminFirstName" className="mb-1 block text-xs font-medium text-donor-muted">
                    {t('auth.register.firstName')}
                  </label>
                  <input
                    id="adminFirstName"
                    type="text"
                    required
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                  />
                </div>
                <div>
                  <label htmlFor="adminLastName" className="mb-1 block text-xs font-medium text-donor-muted">
                    {t('auth.register.lastName')}
                  </label>
                  <input
                    id="adminLastName"
                    type="text"
                    required
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="adminEmail" className="mb-1 block text-xs font-medium text-donor-muted">
                  {t('table.email')}
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  required
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <div>
                <label htmlFor="adminPhone" className="mb-1 block text-xs font-medium text-donor-muted">
                  Phone (optional)
                </label>
                <input
                  id="adminPhone"
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <div>
                <label htmlFor="adminPassword" className="mb-1 block text-xs font-medium text-donor-muted">
                  {t('portal.password')}
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
                <p className="mt-1 text-xs text-donor-muted">
                  {t('validation.passwordRules')}
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-donor-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for approval'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full rounded-lg border border-donor-border px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
          >
            {t('portal.backToSignIn')}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
