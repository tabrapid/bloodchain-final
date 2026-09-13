'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Link2Off, Shield } from 'lucide-react';
import { strongPasswordSchema } from '@bloodchain/validation';
import { resetPassword, isRejectedResetToken, recoveryErrorMessage } from '../../lib/auth';

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
      // correct -- so the whole card changes rather than a line under a field.
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
      <>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-donor-success rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-donor-text">Password updated</h1>
            <p className="text-sm text-donor-muted">BloodChain Management</p>
          </div>
        </div>
        <p className="text-sm text-donor-muted mb-6">
          You have been signed out everywhere else. Sign in with your new password to continue.
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium hover:bg-donor-primary/85 transition-colors"
        >
          Sign in
        </button>
      </>
    );
  }

  if (tokenRejected) {
    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg flex items-center justify-center">
            <Link2Off className="w-6 h-6 text-donor-onDangerMuted" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-donor-text">This link no longer works</h1>
            <p className="text-sm text-donor-muted">BloodChain Management</p>
          </div>
        </div>
        {/* The server will not say which of the three it is, and all three have
            the same remedy, so guessing would add nothing but the risk of being
            wrong. */}
        <p className="text-sm text-donor-muted mb-6">
          Reset links can be used once and expire within the hour. Request a new one and open the
          most recent email.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium text-center hover:bg-donor-primary/85 transition-colors"
        >
          Request a new link
        </Link>
        <Link
          href="/"
          className="mt-3 block w-full text-center text-sm font-medium text-donor-primary hover:underline"
        >
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-donor-primary rounded-lg flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-donor-text">Admin Portal</h1>
          <p className="text-sm text-donor-muted">BloodChain Management</p>
        </div>
      </div>

      <h2 className="text-lg font-medium text-donor-text mb-2">New password</h2>
      <p className="text-sm text-donor-muted mb-4">
        {linkToken
          ? 'Choose a new password for your account. Signing in elsewhere will stop working.'
          : 'Paste the code from your reset email, then choose a new password.'}
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg text-sm text-donor-onDangerMuted"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden when the link supplied it: a 64-character string the user
            cannot meaningfully check is noise, and an editable field invites
            breaking a token that already works. */}
        {!linkToken && (
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-donor-text mb-1">
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
              className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent disabled:opacity-60"
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-donor-text mb-1">
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
            className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-donor-text mb-1">
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
            className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent disabled:opacity-60"
          />
        </div>

        {fieldError ? (
          <p role="alert" className="text-xs text-donor-onDangerMuted">
            {fieldError}
          </p>
        ) : (
          <p className="text-xs text-donor-muted">{POLICY_HINT}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium hover:bg-donor-primary/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Set new password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-donor-muted">
        <Link href="/" className="font-medium text-donor-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="min-h-screen bc-app-bg flex items-center justify-center">
      <div className="bc-glass rounded-card p-8 w-full max-w-md">
        {/* `useSearchParams` opts the tree into client-side rendering, which
            Next requires a Suspense boundary for at build time. */}
        <Suspense fallback={<p className="text-sm text-donor-muted">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
