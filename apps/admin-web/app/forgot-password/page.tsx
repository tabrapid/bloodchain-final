'use client';

import { useState } from 'react';
import { LanguageSwitcher, useTranslation } from '@bloodchain/ui/i18n';
import Link from 'next/link';
import { MailCheck, Shield } from 'lucide-react';
import { requestPasswordReset, recoveryErrorMessage } from '../../lib/auth';

/**
 * Step one of account recovery for platform admins.
 *
 * The API answers a request for an unknown address exactly as it answers one
 * for a registered address, so that the endpoint cannot be used to learn which
 * addresses have accounts. This page keeps that promise: there is no "no
 * account with that email" state and no branch on the response, and the
 * confirmation is worded so it is true either way.
 */
export default function AdminForgotPasswordPage() {
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

  return (
    <div className="min-h-screen bc-app-bg flex items-center justify-center">
      <div className="bc-glass rounded-card p-8 w-full max-w-md">
        {/* A signed-out admin who cannot read this page has no other way to
            change it: the console's switcher lives in the top bar, which only
            renders once you are inside. */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-donor-primary rounded-lg flex items-center justify-center">
            {sentTo ? (
              <MailCheck className="w-6 h-6 text-white" />
            ) : (
              <Shield className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-donor-text">{t('portal.admin.name')}</h1>
            <p className="text-sm text-donor-muted">{t('portal.admin.workspace')}</p>
          </div>
        </div>

        {sentTo ? (
          <>
            <h2 className="text-lg font-medium text-donor-text mb-2">
              {t('auth.forgotPassword.sentTitle')}
            </h2>
            {/* "If an account exists" is not hedging: it is the only true thing
                this page can say, because the server does not tell it. */}
            <p className="text-sm text-donor-muted mb-6">
              {t('auth.forgotPassword.sentBody', { email: sentTo })}
            </p>
            <Link
              href="/"
              className="block w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium text-center hover:bg-donor-primary/85 transition-colors"
            >
              {t('portal.backToSignIn')}
            </Link>
            <button
              onClick={() => setSentTo(null)}
              className="mt-3 w-full text-sm font-medium text-donor-primary hover:underline"
            >
              {t('auth.forgotPassword.useDifferentEmail')}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium text-donor-text mb-2">
              {t('auth.forgotPassword.title')}
            </h2>
            <p className="text-sm text-donor-muted mb-4">{t('auth.forgotPassword.subtitle')}</p>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg text-sm text-donor-onDangerMuted"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-donor-text mb-1">
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
                  className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium hover:bg-donor-primary/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('common.sending') : t('auth.forgotPassword.submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-donor-muted">
              {t('portal.rememberedIt')}{' '}
              <Link href="/" className="font-medium text-donor-primary hover:underline">
                {t('portal.backToSignIn')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
