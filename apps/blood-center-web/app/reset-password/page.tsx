'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Link2Off, Lock } from 'lucide-react';
import { strongPasswordSchema } from '@bloodchain/validation';
import { resetPassword, isRejectedResetToken, recoveryErrorMessage } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';

const POLICY_HINT =
  'Use at least 12 characters with an uppercase and a lowercase letter, a number and a special character.';

/**
 * Step two of account recovery: spend the link and set a new password.
 *
 * The token arrives in the query string, because that is the link the API
 * mails. Password rules are checked here with the same shared schema the server
 * enforces, so the four rules are stated once and the user is not told them one
 * rejection at a time.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get('token') ?? '';

  const [token, setToken] = useState(linkToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const policy = strongPasswordSchema.safeParse(password);
    if (!policy.success) {
      setFieldError(policy.error.issues[0]?.message ?? POLICY_HINT);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      // A refused token is not a form error -- there is nothing on this page to
      // correct -- so the whole page changes rather than a line under a field.
      if (isRejectedResetToken(err)) {
        setTokenRejected(true);
        return;
      }
      setError(recoveryErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
        <CheckCircle className="mb-4 text-donor-success" size={48} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          Password updated
        </h2>
        <p className="mb-6 max-w-md text-donor-muted">
          You have been signed out everywhere else. Sign in with your new password to continue.
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (tokenRejected) {
    return (
      <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
        <Link2Off className="mb-4 text-donor-onDangerMuted" size={48} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          This link no longer works
        </h2>
        {/* The server will not say which of the three it is, and all three have
            the same remedy, so guessing would add nothing but the risk of being
            wrong. */}
        <p className="mb-6 max-w-md text-donor-muted">
          Reset links can be used once and expire within the hour. Request a new one and open the
          most recent email.
        </p>
        <Link
          href="/forgot-password"
          className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
        >
          Request a new link
        </Link>
        <Link href="/" className="mt-4 text-sm font-semibold text-donor-secondary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
      <Lock className="mb-4 text-donor-secondary" size={48} />
      <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">New password</h2>
      <p className="mb-6 max-w-sm text-center text-donor-muted">
        {linkToken
          ? 'Choose a new password for your account. Signing in elsewhere will stop working.'
          : 'Paste the code from your reset email, then choose a new password.'}
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-donor-danger">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        {/* Hidden when the link supplied it: a 64-character string the user
            cannot meaningfully check is noise, and an editable field invites
            breaking a token that already works. */}
        {!linkToken && (
          <div>
            <label
              htmlFor="token"
              className="mb-1 block text-left text-xs font-medium text-donor-muted"
            >
              Reset code
            </label>
            <input
              id="token"
              type="text"
              required
              autoFocus
              disabled={isSubmitting}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary disabled:opacity-60"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-left text-xs font-medium text-donor-muted"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoFocus={Boolean(linkToken)}
            autoComplete="new-password"
            disabled={isSubmitting}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-left text-xs font-medium text-donor-muted"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            disabled={isSubmitting}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary disabled:opacity-60"
          />
        </div>

        {fieldError ? (
          <p role="alert" className="text-left text-xs text-donor-danger">
            {fieldError}
          </p>
        ) : (
          <p className="text-left text-xs text-donor-muted">{POLICY_HINT}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Set new password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-donor-muted">
        <Link href="/" className="font-semibold text-donor-secondary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function BloodCenterResetPasswordPage() {
  return (
    <AppShell
      title="New password"
      subtitle="BLOOD CENTER CONSOLE"
      organizationName="Blood Center Console"
      organizationType="Operations workspace"
      userName="Guest"
    >
      {/* `useSearchParams` opts the tree into client-side rendering, which Next
          requires a Suspense boundary for at build time. */}
      <Suspense fallback={<div className="bc-glass rounded-card p-12 text-donor-muted">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AppShell>
  );
}
