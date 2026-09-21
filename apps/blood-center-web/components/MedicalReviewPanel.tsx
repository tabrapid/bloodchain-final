'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Stethoscope } from 'lucide-react';
import { DataTable, EmptyState, Modal, StatusBadge } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  ApiRequestError,
  getDonorReviews,
  resolveDonorReview,
  type DonorReviewResolution,
  type DonorReviewSummary,
} from '../lib/screening';

const RESOLUTIONS: DonorReviewResolution[] = [
  'RETURNED_TO_ACTIVE',
  'TEMPORARY_DEFERRAL',
  'INDEFINITE_DEFERRAL',
  'REMAINS_UNDER_REVIEW',
];

/**
 * Donors a screening result has put under medical review.
 *
 * What this screen is for is a clinician deciding, and the wording throughout
 * keeps that in front of them: a review is a request to look, not a finding.
 * The only route from one of these to a deferral is a clinician choosing a
 * deferral resolution here and supplying a structured reason code, and the
 * console never offers to "confirm" or "accept" a disposition, because neither
 * would be a decision anybody made.
 *
 * The consequence of a resolution is reported from the server rather than
 * assumed: resolving one review while a second is open leaves the donor under
 * review, and this screen says which happened instead of implying the
 * optimistic case.
 */
export function MedicalReviewPanel({ organizationId }: { organizationId: string }) {
  const { t, formatDateTime } = useTranslation();
  const [reviews, setReviews] = useState<DonorReviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolving, setResolving] = useState<DonorReviewSummary | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);
    try {
      setReviews(await getDonorReviews(organizationId, 'OPEN'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<DonorReviewSummary>[] = [
    { key: 'donorName', header: t('ops.medicalReview.donor'), render: (row) => row.donorName },
    {
      key: 'raisedAt',
      header: t('ops.medicalReview.raised'),
      render: (row) => (
        <span className="text-xs">
          {formatDateTime(row.raisedAt)}
          {row.systemRaised && (
            <span className="ml-2 text-donor-muted">{t('ops.screening.systemRaised')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'source',
      header: t('ops.medicalReview.source'),
      render: (row) => (
        <span className="text-xs text-donor-muted">
          {row.screeningOrderReference ?? t(`ops.medicalReview.sourceKind.${row.sourceKind}`)}
        </span>
      ),
    },
    {
      key: 'trigger',
      header: t('ops.medicalReview.trigger'),
      render: (row) => (
        <StatusBadge variant={row.triggerDisposition === 'BLOCK' ? 'danger' : 'warning'}>
          {t(`ops.screening.disposition.${row.triggerDisposition}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'resolve',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setResolving(row)}
          className="rounded-lg bg-donor-primary px-3 py-1.5 text-xs font-semibold text-donor-onPrimary transition-colors hover:bg-donor-primaryDark"
        >
          {t('ops.medicalReview.resolve')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div
        role="status"
        className="rounded-xl border border-donor-border/60 bg-donor-surfaceMuted p-5 text-sm text-donor-muted"
      >
        <h3 className="font-display text-base font-semibold text-donor-text">
          {t('ops.medicalReview.explainerTitle')}
        </h3>
        <p className="mt-1">{t('ops.medicalReview.explainerBody')}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-sm text-donor-onDangerMuted"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-donor-info/30 bg-donor-infoMuted p-4 text-sm text-donor-onInfoMuted"
        >
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-donor-border/60 bg-donor-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-donor-text">
            {t('ops.medicalReview.openTitle')}
          </h3>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-donor-border px-3 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-surfaceMuted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('actions.refresh')}
          </button>
        </div>

        {!isLoading && reviews.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title={t('ops.medicalReview.noneTitle')}
            description={t('ops.medicalReview.noneHint')}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={reviews}
            loading={isLoading}
            keyExtractor={(row) => row.id}
          />
        )}
      </section>

      {resolving && (
        <ResolveDialog
          organizationId={organizationId}
          review={resolving}
          onClose={() => setResolving(null)}
          onDone={async (message) => {
            setResolving(null);
            setNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ResolveDialog({
  organizationId,
  review,
  onClose,
  onDone,
}: {
  organizationId: string;
  review: DonorReviewSummary;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState<DonorReviewResolution>('RETURNED_TO_ACTIVE');
  const [note, setNote] = useState('');
  const [deferralReasonCode, setDeferralReasonCode] = useState('');
  const [deferralEndsAt, setDeferralEndsAt] = useState('');
  const [confidentialNote, setConfidentialNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defers = resolution === 'TEMPORARY_DEFERRAL' || resolution === 'INDEFINITE_DEFERRAL';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await resolveDonorReview(organizationId, review.id, {
        resolution,
        note: note.trim() || undefined,
        deferralReasonCode: defers ? deferralReasonCode.trim() || undefined : undefined,
        deferralEndsAt:
          resolution === 'TEMPORARY_DEFERRAL' && deferralEndsAt
            ? new Date(deferralEndsAt).toISOString()
            : undefined,
        confidentialNote: defers ? confidentialNote.trim() || undefined : undefined,
      });

      // What the donor's status ACTUALLY became. Resolving one review while
      // another is open leaves them under review, and a console that reported
      // "returned to active" because that is what was chosen would be lying
      // about the one thing this screen exists to get right.
      await onDone(
        t('ops.medicalReview.resolvedAs', {
          status: t(`ops.medicalReview.donorStatus.${outcome.resultingDonorStatus}`),
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof ApiRequestError
          ? submitError.error.message
          : submitError instanceof Error
            ? submitError.message
            : t('errors.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('ops.medicalReview.resolveTitle', { donor: review.donorName })}
      description={t('ops.medicalReview.resolveDescription')}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-donor-border px-4 py-2 text-sm font-semibold text-donor-text"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-donor-onPrimary disabled:opacity-60"
          >
            {busy ? t('ops.common.submitting') : t('ops.medicalReview.resolve')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-3 text-sm text-donor-onDangerMuted"
          >
            {error}
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-donor-text">
            {t('ops.medicalReview.decision')}
          </legend>
          {RESOLUTIONS.map((option) => (
            <label key={option} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="resolution"
                value={option}
                checked={resolution === option}
                onChange={() => setResolution(option)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-donor-text">
                  {t(`ops.medicalReview.resolution.${option}`)}
                </span>
                <span className="block text-xs text-donor-muted">
                  {t(`ops.medicalReview.resolutionHint.${option}`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {defers && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-donor-text">
                {t('ops.medicalReview.deferralReasonCode')}
              </span>
              <input
                type="text"
                value={deferralReasonCode}
                onChange={(event) => setDeferralReasonCode(event.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
              />
              <span className="mt-1 block text-xs text-donor-muted">
                {t('ops.medicalReview.deferralReasonHint')}
              </span>
            </label>

            {resolution === 'TEMPORARY_DEFERRAL' && (
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-donor-text">
                  {t('ops.medicalReview.deferralEndsAt')}
                </span>
                <input
                  type="date"
                  value={deferralEndsAt}
                  onChange={(event) => setDeferralEndsAt(event.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-donor-text">
                {t('ops.medicalReview.confidentialNote')}
              </span>
              <textarea
                value={confidentialNote}
                onChange={(event) => setConfidentialNote(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
              />
              <span className="mt-1 block text-xs text-donor-muted">
                {t('ops.medicalReview.confidentialNoteHint')}
              </span>
            </label>
          </>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-donor-text">
            {t('ops.common.notesOptional')}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
          />
        </label>
      </div>
    </Modal>
  );
}
