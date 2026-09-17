'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Modal, StatusBadge } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';
import {
  ApiRequestError,
  BloodType,
  Donor,
  RhFactor,
  VerificationSource,
  verifyBloodType,
} from '../lib/donors';

const BLOOD_TYPES: BloodType[] = ['A', 'B', 'AB', 'O'];
const RH_FACTORS: RhFactor[] = ['POSITIVE', 'NEGATIVE', 'UNKNOWN'];
const SOURCES: VerificationSource[] = [
  'BLOOD_CENTER',
  'HOSPITAL',
  'LABORATORY',
  'OTHER_AUTHORIZED_SOURCE',
];

const SOURCE_KEYS: Record<VerificationSource, string> = {
  BLOOD_CENTER: 'ops.donors.verification.sourceBloodCenter',
  HOSPITAL: 'ops.donors.verification.sourceHospital',
  LABORATORY: 'ops.donors.verification.sourceLaboratory',
  OTHER_AUTHORIZED_SOURCE: 'ops.donors.verification.sourceOther',
};

/** `A` + `POSITIVE` is what a person reads as "A+". UNKNOWN Rh has no sign. */
export function formatGroup(bloodType: BloodType | null, rhFactor: RhFactor | null): string | null {
  if (!bloodType) return null;
  const sign = rhFactor === 'POSITIVE' ? '+' : rhFactor === 'NEGATIVE' ? '-' : '';
  return `${bloodType}${sign}`;
}

export interface BloodTypeVerificationProps {
  /** The donor whose blood group is being verified; null closes the dialog. */
  donor: Donor | null;
  onClose: () => void;
  /** Called with the profile the server returned, so the table can refresh. */
  onVerified: (updated: Donor) => void;
}

/**
 * The staff side of blood-type verification.
 *
 * It shows what the donor said about themselves, what the platform currently
 * believes, and lets authorized staff either confirm that or correct it. The
 * three verification states are deliberately worded differently rather than
 * being three colours of the same sentence:
 *
 * - UNVERIFIED       the donor's own answer, never checked;
 * - REQUIRES_REVIEW  the donor changed it after a verification, so the
 *                    previous sign-off no longer covers what is on file;
 * - VERIFIED         staff vouched for it, and the server recorded who.
 *
 * Only VERIFIED donors are matched to emergencies, and only a VERIFIED profile
 * can supply the blood group a donation's blood unit is created with.
 */
export function BloodTypeVerification({ donor, onClose, onVerified }: BloodTypeVerificationProps) {
  const { t } = useTranslation();

  const [bloodType, setBloodType] = useState<BloodType>('O');
  const [rhFactor, setRhFactor] = useState<RhFactor>('POSITIVE');
  const [source, setSource] = useState<VerificationSource>('LABORATORY');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form opens on what is already on file, so confirming an existing group
  // is one click and correcting it is an explicit change.
  useEffect(() => {
    if (!donor) return;
    setBloodType(donor.bloodType ?? 'O');
    setRhFactor(donor.rhFactor ?? 'POSITIVE');
    setNote('');
    setError(null);
  }, [donor]);

  if (!donor) return null;

  const onFile = formatGroup(donor.bloodType, donor.rhFactor);
  const donorName = `${donor.user.firstName} ${donor.user.lastName}`.trim();

  const standing =
    donor.verificationStatus === 'VERIFIED'
      ? { variant: 'success' as const, text: t('ops.donors.verification.verified') }
      : donor.verificationStatus === 'REQUIRES_REVIEW'
        ? { variant: 'warning' as const, text: t('ops.donors.verification.requiresReview') }
        : { variant: 'default' as const, text: t('ops.donors.verification.selfReported') };

  async function handleSubmit() {
    if (!donor) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await verifyBloodType(donor.userId, {
        bloodType,
        rhFactor,
        source,
        note: note.trim() || undefined,
      });
      onVerified(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.error.message : t('ops.donors.verification.failed'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('ops.donors.verification.title')}
      description={t('ops.donors.verification.forDonor', { name: donorName })}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? t('ops.donors.verification.submitting')
              : t('ops.donors.verification.submit')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg bc-solid p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-2xl font-semibold text-donor-text">
              {onFile ?? '—'}
            </span>
            <StatusBadge variant={standing.variant}>
              {donor.verificationStatus.replace('_', ' ')}
            </StatusBadge>
          </div>
          <p className="mt-2 flex items-start gap-2 text-sm text-donor-muted">
            {donor.verificationStatus === 'VERIFIED' ? (
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-donor-success" />
            ) : (
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-donor-warning" />
            )}
            <span>{onFile ? standing.text : t('ops.donors.verification.noneOnFile')}</span>
          </p>
          {donor.bloodTypeVerifiedAt && (
            <p className="mt-1 text-xs text-donor-muted">
              {t('ops.donors.verification.provenance', {
                date: new Date(donor.bloodTypeVerifiedAt).toLocaleString(),
                source: donor.bloodTypeSource
                  ? t(SOURCE_KEYS[donor.bloodTypeSource])
                  : t('ops.donors.verification.sourceOther'),
              })}
            </p>
          )}
          {donor.bloodTypeNote && (
            <p className="mt-1 text-xs italic text-donor-muted">{donor.bloodTypeNote}</p>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-donor-text">
            {t('ops.donors.verification.confirmOrCorrect')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-donor-muted">
                {t('ops.donors.verification.bloodGroup')}
              </span>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value as BloodType)}
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-donor-muted">
                {t('ops.donors.verification.rhFactor')}
              </span>
              <select
                value={rhFactor}
                onChange={(e) => setRhFactor(e.target.value as RhFactor)}
                className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
              >
                {RH_FACTORS.map((rh) => (
                  <option key={rh} value={rh}>
                    {rh}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-donor-muted">
            {t('ops.donors.verification.source')}
          </span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as VerificationSource)}
            className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(SOURCE_KEYS[s])}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-donor-muted">{t('ops.donors.verification.note')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t('ops.donors.verification.notePlaceholder')}
            className="w-full rounded-lg bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
          />
        </label>

        <p className="text-xs text-donor-muted">{t('ops.donors.verification.attribution')}</p>

        {error && <p className="text-sm text-donor-danger">{error}</p>}
      </div>
    </Modal>
  );
}
