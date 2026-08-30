'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle } from 'lucide-react';
import { registerOrganization, ApiRequestError } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';

export default function RegisterBloodCenterPage() {
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
        organizationType: 'BLOOD_CENTER',
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
      setError(err instanceof ApiRequestError ? err.error.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppShell
        title="Registration Submitted"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <CheckCircle className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Registration submitted
          </h2>
          <p className="mb-6 max-w-md text-donor-muted">
            Check <strong>{adminEmail}</strong> to verify your email address. Once verified, your
            blood center account will be reviewed by a BloodChain admin — you&apos;ll be able
            to sign in as soon as it&apos;s approved.
          </p>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
          >
            Back to sign in
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Register Your Blood Center"
      subtitle="BLOOD CENTER CONSOLE"
      organizationName="Northstar Blood Center (Development)"
      organizationType="Operations workspace"
      userName="Guest"
    >
      <div className="mx-auto max-w-lg bc-glass rounded-card p-8">
        <Building2 className="mb-4 text-donor-secondary" size={40} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          Register your blood center
        </h2>
        <p className="mb-6 text-sm text-donor-muted">
          Create an administrator account for your blood center. A BloodChain admin will
          review and approve your organization before you can start using the dashboard.
        </p>

        {error && <p className="mb-4 text-sm text-donor-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-donor-muted">
              Blood center details
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="organizationName" className="mb-1 block text-xs font-medium text-donor-muted">
                  Blood center name
                </label>
                <input
                  id="organizationName"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                />
              </div>
              <div>
                <label htmlFor="address" className="mb-1 block text-xs font-medium text-donor-muted">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                />
              </div>
              <div>
                <label htmlFor="organizationPhone" className="mb-1 block text-xs font-medium text-donor-muted">
                  Phone
                </label>
                <input
                  id="organizationPhone"
                  type="tel"
                  value={organizationPhone}
                  onChange={(e) => setOrganizationPhone(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-donor-muted">
              Administrator account
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="adminFirstName" className="mb-1 block text-xs font-medium text-donor-muted">
                    First name
                  </label>
                  <input
                    id="adminFirstName"
                    type="text"
                    required
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="adminLastName" className="mb-1 block text-xs font-medium text-donor-muted">
                    Last name
                  </label>
                  <input
                    id="adminLastName"
                    type="text"
                    required
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="adminEmail" className="mb-1 block text-xs font-medium text-donor-muted">
                  Email
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  required
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
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
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                />
              </div>
              <div>
                <label htmlFor="adminPassword" className="mb-1 block text-xs font-medium text-donor-muted">
                  Password
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
                />
                <p className="mt-1 text-xs text-donor-muted">
                  At least 12 characters, with uppercase, lowercase, a number, and a symbol.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for approval'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full rounded-lg border border-donor-border px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-border"
          >
            Back to sign in
          </button>
        </form>
      </div>
    </AppShell>
  );
}
