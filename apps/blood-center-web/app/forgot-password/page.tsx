'use client';

import { useState } from 'react';
import { useTranslation } from '@bloodchain/ui/i18n';
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
  const { t } = useTranslation();
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
        title={t('auth.forgotPassword.sentTitle')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={t('portal.bloodCenter.name')}
        organizationType={t('portal.bloodCenter.workspace')}
        userName={t('portal.guest')}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <MailCheck className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('auth.forgotPassword.sentTitle')}
          </h2>
          {/* "If an account exists" is not hedging: it is the only true thing
              this page can say, because the server does not tell it. */}
          <p className="mb-6 max-w-md text-donor-muted">
            {t('auth.forgotPassword.sentBody', { email: sentTo })}
          </p>
          <Link
            href="/"
            className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
          >
            {t('portal.backToSignIn')}
          </Link>
          <button
            onClick={() => setSentTo(null)}
            className="mt-4 text-sm font-semibold text-donor-secondary hover:underline"
          >
            {t('auth.forgotPassword.useDifferentEmail')}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('auth.forgotPassword.title')}
      subtitle={t('portal.bloodCenter.console')}
      organizationName={t('portal.bloodCenter.name')}
      organizationType={t('portal.bloodCenter.workspace')}
      userName={t('portal.guest')}
    >
      <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
        <KeyRound className="mb-4 text-donor-secondary" size={48} />
        <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
          {t('auth.forgotPassword.title')}
        </h2>
        <p className="mb-6 max-w-sm text-center text-donor-muted">
          {t('auth.forgotPassword.subtitle')}
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
              {t('portal.email')}
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
            {isSubmitting ? t('common.sending') : t('auth.forgotPassword.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-donor-muted">
          {t('portal.rememberedIt')}{' '}
          <Link href="/" className="font-semibold text-donor-secondary hover:underline">
            {t('portal.backToSignIn')}
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
