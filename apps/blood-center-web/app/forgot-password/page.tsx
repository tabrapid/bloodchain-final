'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, MailCheck } from 'lucide-react';
import { requestPasswordReset, recoveryErrorMessage } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';

/**
 * Step one of account recovery for blood centre staff.
 *
 * The API answers a request for an unknown address exactly as it answers one
 * for a registered address, so that the endpoint cannot be used to learn which
 * addresses have accounts. This page keeps that promise: there is no "no
 * account with that email" state and no branch on the response, and the
 * confirmation is worded so it is true either way.
 */
export default function BloodCenterForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setError(recoveryErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AppShell
        title="Check your email"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Blood Center Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <MailCheck className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Check your email
          </h2>
          {/* "If an account exists" is not hedging: it is the only true thing
              this page can say, because the server does not tell it. */}
          <p className="mb-6 max-w-md text-donor-muted">
            If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. The link
            can be used once and expires within the hour.
          </p>
          <Link
            href="/"
            className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
          >
            Back to sign in
          </Link>
          <button
            onClick={() => setSentTo(null)}
            className="mt-4 text-sm font-semibold text-donor-secondary hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Reset your password"
      subtitle="BLOOD CENTER CONSOLE"
      organizationName="Blood Center Console"
      organizationType="Operations workspace"
      userName="Guest"
    >
      <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
        <KeyRound className="mb-4 text-donor-secondary" size={48} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          Reset your password
        </h2>
        <p className="mb-6 max-w-sm text-center text-donor-muted">
          Enter the email address you sign in with and we&apos;ll send you a link to set a new
          password.
        </p>

        {error && (
          <p role="alert" className="mb-4 text-sm text-donor-danger">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-left text-xs font-medium text-donor-muted"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-donor-muted">
          Remembered it?{' '}
          <Link href="/" className="font-semibold text-donor-secondary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
