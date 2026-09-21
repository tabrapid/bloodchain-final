'use client';

import { useCallback, useEffect, useState } from 'react';
import { PackageX, RefreshCw } from 'lucide-react';
import { DataTable, EmptyState, Modal, StatusBadge } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  ApiRequestError,
  acknowledgeRecall,
  getRecalls,
  type RecallCaseSummary,
} from '../lib/screening';

/**
 * Recalls this organization opened, and recalls that reached it.
 *
 * The two are one list on purpose: a recall that only the organization which
 * opened it can see has not been communicated to anybody. What differs is what
 * the row contains, and that difference is decided on the server -- this
 * component renders `confidentialDetail` when the key is present and shows
 * nothing at all when it is not. It never renders "withheld", because saying
 * that clinical detail exists is itself information a receiving organization is
 * not entitled to.
 */
export function RecallPanel({ organizationId }: { organizationId: string }) {
  const { t, formatDateTime } = useTranslation();
  const [cases, setCases] = useState<RecallCaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<RecallCaseSummary | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);
    try {
      setCases(await getRecalls(organizationId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<RecallCaseSummary>[] = [
    {
      key: 'recallReference',
      header: t('table.reference'),
      render: (row) => <span className="font-mono text-xs">{row.recallReference}</span>,
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (row) => (
        <StatusBadge
          variant={row.status === 'CLOSED' ? 'default' : row.status === 'OPEN' ? 'danger' : 'warning'}
        >
          {t(`ops.recall.status.${row.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'trigger',
      header: t('ops.recall.trigger'),
      render: (row) => (
        <span className="text-xs text-donor-muted">
          {t(`ops.recall.triggerKind.${row.triggerKind}`)}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('ops.recall.role'),
      render: (row) => (
        <span className="text-xs">
          {row.isOpener ? t('ops.recall.opener') : t('ops.recall.holder')}
        </span>
      ),
    },
    {
      key: 'components',
      header: t('ops.recall.myComponents'),
      render: (row) => <span className="text-xs">{row.myComponentCount}</span>,
    },
    {
      key: 'openedAt',
      header: t('ops.recall.opened'),
      render: (row) => <span className="text-xs">{formatDateTime(row.openedAt)}</span>,
    },
    {
      key: 'acknowledge',
      header: '',
      render: (row) =>
        row.acknowledged ? (
          <span className="text-xs text-donor-muted">{t('ops.recall.acknowledged')}</span>
        ) : (
          <button
            type="button"
            onClick={() => setAcknowledging(row)}
            className="rounded-lg bg-donor-primary px-3 py-1.5 text-xs font-semibold text-donor-onPrimary transition-colors hover:bg-donor-primaryDark"
          >
            {t('ops.recall.acknowledge')}
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
          <div>
            <h3 className="font-display text-lg font-semibold text-donor-text">
              {t('ops.recall.title')}
            </h3>
            <p className="mt-1 text-sm text-donor-muted">{t('ops.recall.hint')}</p>
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

        {!isLoading && cases.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title={t('ops.recall.noneTitle')}
            description={t('ops.recall.noneHint')}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={cases}
              loading={isLoading}
              keyExtractor={(row) => row.id}
            />
            <ul className="mt-4 space-y-2">
              {cases
                .filter((row) => row.operationalReason)
                .map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-donor-border/60 bg-donor-surfaceMuted p-3 text-sm"
                  >
                    <p className="font-mono text-xs text-donor-muted">{row.recallReference}</p>
                    <p className="mt-1 text-donor-text">{row.operationalReason}</p>
                    {/*
                     * Rendered only when the key is there. The server omits it
                     * entirely for an organization that did not open the case,
                     * and an explicit "withheld" here would undo that.
                     */}
                    {row.confidentialDetail && (
                      <p className="mt-2 border-l-2 border-donor-danger/50 pl-3 text-xs text-donor-muted">
                        {row.confidentialDetail}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      {acknowledging && (
        <AcknowledgeDialog
          organizationId={organizationId}
          recallCase={acknowledging}
          onClose={() => setAcknowledging(null)}
          onDone={async (message) => {
            setAcknowledging(null);
            setNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AcknowledgeDialog({
  organizationId,
  recallCase,
  onClose,
  onDone,
}: {
  organizationId: string;
  recallCase: RecallCaseSummary;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [responseNote, setResponseNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await acknowledgeRecall(organizationId, recallCase.id, {
        responseNote: responseNote.trim() || undefined,
      });
      await onDone(t('ops.recall.acknowledgedNotice', { reference: recallCase.recallReference }));
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
      title={t('ops.recall.acknowledgeTitle', { reference: recallCase.recallReference })}
      description={t('ops.recall.acknowledgeDescription')}
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
            {busy ? t('ops.common.acknowledging') : t('ops.recall.acknowledge')}
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

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-donor-text">
            {t('ops.recall.responseNote')}
          </span>
          <textarea
            value={responseNote}
            onChange={(event) => setResponseNote(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
          />
          <span className="mt-1 block text-xs text-donor-muted">
            {t('ops.recall.responseNoteHint')}
          </span>
        </label>
      </div>
    </Modal>
  );
}
