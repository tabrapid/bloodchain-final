'use client';

import { useEffect, useState } from 'react';
import { Mail, UserRound } from 'lucide-react';
import { LoadingState, PasswordChangeCard } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';
import { strongPasswordSchema } from '@bloodchain/validation';

import { changePassword, isAuthenticated, me, MeResponse } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';

/**
 * The account this person is signed in with, and the one thing they need to be
 * able to do to it themselves.
 *
 * Every console's Settings entry was disabled, so staff who wanted to change
 * their own password had to go through the forgotten-password flow on a
 * password they had not forgotten -- which needs a mailbox they may not read.
 */
export default function AccountPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (isAuthenticated()) setUser(await me());
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const shell = {
    title: t('portal.account.title'),
    subtitle: t('portal.account.subtitle'),
    userName: user ? `${user.firstName} ${user.lastName}` : t('portal.guest'),
  };

  if (isLoading) {
    return (
      <AppShell {...shell}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell {...shell}>
      <div className="grid max-w-3xl gap-6">
        <section className="bc-glass rounded-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-donor-text">
            {t('portal.account.signedInAs')}
          </h2>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-donor-text">
              <UserRound size={14} className="text-donor-muted" />
              {user ? `${user.firstName} ${user.lastName}` : t('portal.guest')}
            </p>
            <p className="flex items-center gap-2 text-donor-text">
              <Mail size={14} className="text-donor-muted" />
              {user?.email ?? '—'}
            </p>
          </div>
        </section>

        <PasswordChangeCard
          onSubmit={changePassword}
          // The same policy the API enforces and registration applies, read
          // from the shared schema rather than restated here -- a second copy
          // is a second thing to forget to update.
          validate={(newPassword) =>
            strongPasswordSchema.safeParse(newPassword).success
              ? null
              : t('portal.account.passwordPolicy')
          }
        />
      </div>
    </AppShell>
  );
}
