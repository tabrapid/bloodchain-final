'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { DataTable, EmptyState, Modal, StatusBadge } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  ApiRequestError,
  correctScreeningResult,
  getScreeningOrder,
  getScreeningOrders,
  recordScreeningResult,
  reviewScreeningResult,
  type SafetyDisposition,
  type ScreeningOrderDetail,
  type ScreeningOrderSummary,
  type ScreeningRequirementView,
} from '../lib/screening';

/**
 * The screening worklist, and what each order is still waiting for.
 *
 * Three things this component deliberately does not do:
 *
 * 1. **It does not interpret a result.** The raw code is typed in and sent; the
 *    disposition comes back from the server, decided by the approved policy.
 *    A `resultCode === 'NEGATIVE' ? 'clear' : ...` anywhere in this file would
 *    be a clinical rule living in a React component.
 * 2. **It does not offer a way to review your own result.** The button is
 *    absent for the person who recorded it, and the server refuses it anyway --
 *    two barriers, because a disabled button is a suggestion and a 403 is a
 *    rule.
 * 3. **It does not use `alert()`.** Every outcome, including the ones that open
 *    a recall, is rendered in the page where it can be read, translated and
 *    left on screen.
 */
export function ScreeningPanel({
  organizationId,
  currentUserName,
}: {
  organizationId: string;
  /** Used only to hide the review control on your own result. */
  currentUserName: string | null;
}) {
  const { t, formatDateTime } = useTranslation();
  const [orders, setOrders] = useState<ScreeningOrderSummary[]>([]);
  const [selected, setSelected] = useState<ScreeningOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);
    try {
      setOrders(await getScreeningOrders(organizationId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openOrder = useCallback(
    async (orderId: string) => {
      setError(null);
      try {
        setSelected(await getScreeningOrder(organizationId, orderId));
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : t('errors.generic'));
      }
    },
    [organizationId, t],
  );

  const columns: DataTableColumn<ScreeningOrderSummary>[] = [
    { key: 'orderReference', header: t('table.reference'), render: (order) => order.orderReference },
    {
      key: 'donationReference',
      header: t('ops.screening.donation'),
      render: (order) => order.donationReference,
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (order) => (
        <StatusBadge variant={orderVariant(order.status)}>
          {t(`ops.screening.orderStatus.${order.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'sample',
      header: t('ops.screening.sample'),
      render: (order) =>
        order.sample ? (
          <span className="font-mono text-xs">{order.sample.sampleReference}</span>
        ) : (
          <span className="text-xs text-donor-muted">{t('ops.screening.noSample')}</span>
        ),
    },
    {
      /**
       * The pinned version, on the worklist rather than buried in the detail.
       * An order raised under version 3 asked for what version 3 required, and
       * that stays true after version 4 is approved.
       */
      key: 'policyVersion',
      header: t('ops.screening.policyVersion'),
      render: (order) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">v{order.policyVersion}</span>
          {order.developmentOnly && (
            <StatusBadge variant="warning">{t('ops.screening.developmentPolicy')}</StatusBadge>
          )}
        </span>
      ),
    },
    {
      key: 'progress',
      header: t('ops.screening.reviewed'),
      render: (order) => (
        <span className="text-xs text-donor-muted">
          {t('ops.screening.reviewedOf', {
            reviewed: order.reviewedResultCount,
            total: order.resultCount,
          })}
        </span>
      ),
    },
    {
      key: 'requestedAt',
      header: t('ops.screening.requested'),
      render: (order) => (
        <span className="text-xs">
          {formatDateTime(order.requestedAt)}
          {order.systemRaised && (
            <span className="ml-2 text-donor-muted">{t('ops.screening.systemRaised')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'open',
      header: '',
      render: (order) => (
        <button
          type="button"
          onClick={() => void openOrder(order.id)}
          className="rounded-lg border border-donor-border px-3 py-1.5 text-xs font-semibold text-donor-text transition-colors hover:bg-donor-surfaceMuted"
        >
          {t('actions.viewDetails')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-sm text-donor-onDangerMuted"
        >
          {error}
        </div>
      )}

      <section className="rounded-xl border border-donor-border/60 bg-donor-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-donor-text">
              {t('ops.screening.worklistTitle')}
            </h3>
            <p className="mt-1 text-sm text-donor-muted">{t('ops.screening.worklistHint')}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-donor-border px-3 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-surfaceMuted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('actions.refresh')}
          </button>
        </div>

        {!isLoading && orders.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t('ops.screening.noneTitle')}
            description={t('ops.screening.noneHint')}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={orders}
            loading={isLoading}
            keyExtractor={(order) => order.id}
          />
        )}
      </section>

      {selected && (
        <ScreeningOrderDialog
          organizationId={organizationId}
          order={selected}
          currentUserName={currentUserName}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
            setSelected(await getScreeningOrder(organizationId, selected.id));
          }}
        />
      )}
    </div>
  );
}

function orderVariant(status: ScreeningOrderSummary['status']) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'AWAITING_REVIEW') return 'warning' as const;
  return 'default' as const;
}

/**
 * One order, requirement by requirement.
 *
 * The screen answers the only question the worklist cannot: for this donation,
 * which requirements have an answer, which of those answers a person has
 * reviewed, and which of them the approved policy could not interpret at all.
 * The third is a state of its own and is rendered as one -- not as a blank, and
 * not folded in with "needs review", because "nobody has looked yet" and "no
 * rule describes this code" are different problems with different fixes.
 */
function ScreeningOrderDialog({
  organizationId,
  order,
  currentUserName,
  onClose,
  onChanged,
}: {
  organizationId: string;
  order: ScreeningOrderDetail;
  currentUserName: string | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t, formatDateTime } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entry, setEntry] = useState<ScreeningRequirementView | null>(null);
  const [correcting, setCorrecting] = useState<ScreeningRequirementView | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      await onChanged();
    } catch (actionError) {
      // Rendered in the dialog, never in an `alert()`: an operator needs to
      // read a refusal, and on this screen a refusal can be a safety decision.
      setError(
        actionError instanceof ApiRequestError
          ? actionError.error.message
          : actionError instanceof Error
            ? actionError.message
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
      title={t('ops.screening.orderTitle', { reference: order.orderReference })}
      description={t('ops.screening.orderDescription', {
        donation: order.donation.donationReference,
        version: order.policyVersion,
      })}
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {order.policy.developmentOnly && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-donor-warning/40 bg-donor-warningMuted p-3 text-sm text-donor-onWarningMuted"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{t('ops.screening.developmentPolicyBody')}</p>
          </div>
        )}

        {order.policy.currentVersion !== order.policyVersion && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-donor-border bg-donor-surfaceMuted p-3 text-sm text-donor-muted"
          >
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {t('ops.screening.pinnedVersionBody', {
                pinned: order.policyVersion,
                current: order.policy.currentVersion,
              })}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-3 text-sm text-donor-onDangerMuted"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-lg border border-donor-info/30 bg-donor-infoMuted p-3 text-sm text-donor-onInfoMuted"
          >
            {notice}
          </div>
        )}

        <ul className="space-y-3">
          {order.requirements.map((requirement) => (
            <li
              key={requirement.code}
              className="rounded-lg border border-donor-border/60 bg-donor-surfaceMuted p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-donor-text">
                    {requirement.code}
                  </p>
                  {requirement.description && (
                    <p className="mt-0.5 text-xs text-donor-muted">{requirement.description}</p>
                  )}
                </div>
                <RequirementState requirement={requirement} />
              </div>

              {requirement.result ? (
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="font-semibold">{t('ops.screening.resultCode')}</dt>
                    <dd className="font-mono">{requirement.result.resultCode}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">{t('ops.screening.recordedBy')}</dt>
                    <dd className="truncate">
                      {requirement.result.performedByName ?? t('ops.screening.unattributed')}
                      {requirement.result.performedAt
                        ? ` · ${formatDateTime(requirement.result.performedAt)}`
                        : ''}
                    </dd>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="shrink-0 font-semibold">{t('ops.screening.reviewedBy')}</dt>
                    <dd className="min-w-0 truncate">
                      {requirement.result.reviewedAt
                        ? `${requirement.result.reviewedByName ?? t('ops.screening.unattributed')} · ${formatDateTime(requirement.result.reviewedAt)}`
                        : t('ops.screening.notReviewed')}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-donor-muted">{t('ops.screening.noResultYet')}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {!requirement.result && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEntry(requirement)}
                    className="rounded-lg bg-donor-primary px-3 py-1.5 text-xs font-semibold text-donor-onPrimary transition-colors hover:bg-donor-primaryDark disabled:opacity-60"
                  >
                    {t('ops.screening.recordResult')}
                  </button>
                )}

                {requirement.result &&
                  !requirement.result.reviewedAt &&
                  /*
                   * Hidden rather than disabled for the person who recorded it.
                   * The server refuses it as well -- this only saves them the
                   * click, it is not what makes the rule true.
                   */
                  requirement.result.performedByName !== currentUserName && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await reviewScreeningResult(organizationId, requirement.result!.id);
                          return t('ops.screening.reviewRecorded');
                        })
                      }
                      className="rounded-lg bg-donor-primary px-3 py-1.5 text-xs font-semibold text-donor-onPrimary transition-colors hover:bg-donor-primaryDark disabled:opacity-60"
                    >
                      {t('ops.screening.review')}
                    </button>
                  )}

                {requirement.result &&
                  requirement.result.performedByName === currentUserName &&
                  !requirement.result.reviewedAt && (
                    <p className="text-xs text-donor-muted">{t('ops.screening.cannotReviewOwn')}</p>
                  )}

                {requirement.result && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCorrecting(requirement)}
                    className="rounded-lg border border-donor-border px-3 py-1.5 text-xs font-semibold text-donor-text transition-colors hover:bg-donor-surface disabled:opacity-60"
                  >
                    {t('ops.screening.correct')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {order.supersededResults.length > 0 && (
          <details className="rounded-lg border border-donor-border/60 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-donor-text">
              {t('ops.screening.supersededTitle', { count: order.supersededResults.length })}
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-donor-muted">
              {order.supersededResults.map((result) => (
                <li key={result.id} className="flex flex-wrap gap-2">
                  <span className="font-mono">{result.requirementCode}</span>
                  <span className="font-mono">{result.resultCode}</span>
                  <span>{t(`ops.screening.disposition.${result.disposition}`)}</span>
                  {result.supersededAt && <span>{formatDateTime(result.supersededAt)}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {entry && (
        <RecordResultDialog
          organizationId={organizationId}
          orderId={order.id}
          requirement={entry}
          onClose={() => setEntry(null)}
          onDone={async (message) => {
            setEntry(null);
            setNotice(message);
            await onChanged();
          }}
        />
      )}

      {correcting?.result && (
        <CorrectResultDialog
          organizationId={organizationId}
          requirement={correcting}
          onClose={() => setCorrecting(null)}
          onDone={async (message) => {
            setCorrecting(null);
            setNotice(message);
            await onChanged();
          }}
        />
      )}
    </Modal>
  );
}

/**
 * The four states a requirement can be in, kept apart.
 *
 * `dispositionPolicyVersion === null` is the one worth the extra branch: it
 * means no rule in the approved policy described the recorded code, so the
 * system required a person rather than guessing. Rendering that as plain
 * "review required" would hide a configuration gap behind what looks like a
 * clinical finding.
 */
function RequirementState({ requirement }: { requirement: ScreeningRequirementView }) {
  const { t } = useTranslation();
  const result = requirement.result;

  if (!result) {
    return <StatusBadge variant="default">{t('ops.screening.state.awaitingResult')}</StatusBadge>;
  }

  if (result.dispositionPolicyVersion === null) {
    return (
      <StatusBadge variant="warning">{t('ops.screening.state.notInterpreted')}</StatusBadge>
    );
  }

  if (result.disposition !== 'CLEAR') {
    return (
      <StatusBadge variant={result.disposition === 'BLOCK' ? 'danger' : 'warning'}>
        {t(`ops.screening.disposition.${result.disposition satisfies SafetyDisposition}`)}
      </StatusBadge>
    );
  }

  return result.reviewedAt ? (
    <StatusBadge variant="success">{t('ops.screening.state.clearedAndReviewed')}</StatusBadge>
  ) : (
    <StatusBadge variant="warning">{t('ops.screening.state.awaitingReview')}</StatusBadge>
  );
}

/** Entering a result: the raw code plus its provenance. Nothing is interpreted here. */
function RecordResultDialog({
  organizationId,
  orderId,
  requirement,
  onClose,
  onDone,
}: {
  organizationId: string;
  orderId: string;
  requirement: ScreeningRequirementView;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resultCode, setResultCode] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [reagentLot, setReagentLot] = useState('');
  const [analyzerReference, setAnalyzerReference] = useState('');
  const [methodReference, setMethodReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!resultCode.trim()) {
      setError(t('ops.screening.resultCodeRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const recorded = await recordScreeningResult(organizationId, orderId, {
        requirementCode: requirement.code,
        resultCode: resultCode.trim(),
        resultValue: resultValue.trim() || undefined,
        reagentLot: reagentLot.trim() || undefined,
        analyzerReference: analyzerReference.trim() || undefined,
        methodReference: methodReference.trim() || undefined,
      });

      // What the server decided, said back plainly. Especially the two cases an
      // operator must not have to infer: that no rule described the code, and
      // that a medical review was opened on the donor.
      const parts = [
        recorded.dispositionMapped
          ? t('ops.screening.recordedAs', {
              disposition: t(`ops.screening.disposition.${recorded.disposition}`),
            })
          : t('ops.screening.recordedUnmapped'),
      ];
      if (recorded.medicalReviewOpened) parts.push(t('ops.screening.medicalReviewOpened'));
      await onDone(parts.join(' '));
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
      title={t('ops.screening.recordTitle', { requirement: requirement.code })}
      description={t('ops.screening.recordDescription')}
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
            {busy ? t('ops.common.submitting') : t('ops.screening.recordResult')}
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

        <Field label={t('ops.screening.resultCode')} value={resultCode} onChange={setResultCode} />
        <Field
          label={t('ops.screening.resultValue')}
          value={resultValue}
          onChange={setResultValue}
        />
        <Field label={t('ops.screening.reagentLot')} value={reagentLot} onChange={setReagentLot} />
        <Field
          label={t('ops.screening.analyzer')}
          value={analyzerReference}
          onChange={setAnalyzerReference}
        />
        <Field
          label={t('ops.screening.method')}
          value={methodReference}
          onChange={setMethodReference}
        />

        <p className="text-xs text-donor-muted">{t('ops.screening.provenanceHint')}</p>
      </div>
    </Modal>
  );
}

/** Correcting a result. Never an edit: the original stays, and a recall may open. */
function CorrectResultDialog({
  organizationId,
  requirement,
  onClose,
  onDone,
}: {
  organizationId: string;
  requirement: ScreeningRequirementView;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resultCode, setResultCode] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!resultCode.trim() || reason.trim().length < 3) {
      setError(t('ops.screening.correctionNeedsBoth'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const corrected = await correctScreeningResult(organizationId, requirement.result!.id, {
        resultCode: resultCode.trim(),
        reason: reason.trim(),
      });

      // A recall is the most consequential thing this console can cause, so it
      // is reported explicitly either way -- including when none was opened,
      // with the reason why not.
      const parts = [t('ops.screening.correctionRecorded')];
      parts.push(
        corrected.recallOpened
          ? t('ops.screening.recallOpened')
          : t('ops.screening.noRecallOpened', {
              count: corrected.releasedComponentsAtCorrection,
            }),
      );
      if (corrected.medicalReviewOpened) parts.push(t('ops.screening.medicalReviewOpened'));
      await onDone(parts.join(' '));
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
      title={t('ops.screening.correctTitle', { requirement: requirement.code })}
      description={t('ops.screening.correctDescription', {
        current: requirement.result?.resultCode ?? '',
      })}
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
            className="rounded-lg bg-donor-danger px-4 py-2 text-sm font-semibold text-donor-onPrimary disabled:opacity-60"
          >
            {busy ? t('ops.common.submitting') : t('ops.screening.correct')}
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

        <div className="flex items-start gap-2 rounded-lg border border-donor-warning/40 bg-donor-warningMuted p-3 text-sm text-donor-onWarningMuted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t('ops.screening.correctionWarning')}</p>
        </div>

        <Field
          label={t('ops.screening.correctedResultCode')}
          value={resultCode}
          onChange={setResultCode}
        />
        <Field label={t('ops.screening.correctionReason')} value={reason} onChange={setReason} />
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-donor-text">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
      />
    </label>
  );
}

/** Exported for the release screen: what screening still owes a component. */
export function ScreeningSummaryIcon({ satisfied }: { satisfied: boolean }) {
  return satisfied ? (
    <CheckCircle2 className="h-4 w-4 text-donor-success" aria-hidden="true" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-donor-warning" aria-hidden="true" />
  );
}
