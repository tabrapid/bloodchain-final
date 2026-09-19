'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../cn';

export interface PasswordChangeCardProps {
  /**
   * The portal's own call to `POST /auth/change-password`.
   *
   * Passed in rather than imported, because each portal has its own request
   * helper (base URL, token storage, refresh-and-retry). The *endpoint* is the
   * same one the mobile app uses -- there is one password system, and this adds
   * no second one.
   */
  onSubmit: (input: { currentPassword: string; newPassword: string }) => Promise<unknown>;
  /** Validates the new password against the shared policy; null when it passes. */
  validate?: (newPassword: string) => string | null;
  /** Shown after a successful change, e.g. "you were signed out elsewhere". */
  afterChangeNote?: string;
  className?: string;
}

/**
 * Self-service password change for staff.
 *
 * All three consoles had a Settings entry that was either disabled or held
 * nothing about the account, so a member of staff who wanted to change their
 * own password had to use the forgotten-password flow on a password they had
 * not forgotten. This is the same `POST /auth/change-password` the mobile app
 * calls, which also revokes every refresh token for the account -- so the
 * confirmation says so rather than leaving people wondering why other devices
 * signed out.
 */
export function PasswordChangeCard({
  onSubmit,
  validate,
  afterChangeNote,
  className,
}: PasswordChangeCardProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword !== confirmPassword) {
      setError(t('portal.account.passwordsDoNotMatch'));
      return;
    }

    const policyError = validate?.(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ currentPassword, newPassword });
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      // The server's own message: "Current password is incorrect" is the one
      // the person actually needs, and a generic failure line would hide it.
      setError(err instanceof Error ? err.message : t('portal.account.changeFailed'));
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-primary focus:outline-none';

  return (
    <section className={cn('bc-glass rounded-card p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        <KeyRound size={16} className="text-donor-muted" />
        <h2 className="text-sm font-semibold text-donor-text">
          {t('portal.account.changePassword')}
        </h2>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label
            htmlFor="current-password"
            className="mb-1 block text-xs font-semibold text-donor-muted"
          >
            {t('portal.account.currentPassword')}
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={field}
          />
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="mb-1 block text-xs font-semibold text-donor-muted"
          >
            {t('portal.account.newPassword')}
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={field}
          />
          <p className="mt-1 text-xs text-donor-muted">{t('portal.account.passwordPolicy')}</p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1 block text-xs font-semibold text-donor-muted"
          >
            {t('portal.account.confirmPassword')}
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={field}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-donor-danger/40 bg-donor-dangerMuted px-3 py-2 text-sm text-donor-onDangerMuted"
          >
            {error}
          </p>
        )}

        {done && (
          <p className="flex items-start gap-2 rounded-lg border border-donor-success/40 bg-donor-successMuted px-3 py-2 text-sm text-donor-onSuccessMuted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" />
            <span>{afterChangeNote ?? t('portal.account.changed')}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
        >
          {saving ? t('portal.account.saving') : t('portal.account.changePassword')}
        </button>
      </form>
    </section>
  );
}
