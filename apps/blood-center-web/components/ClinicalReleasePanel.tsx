'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FlaskConical, Lock, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { DataTable, EmptyState, StatusBadge } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  getUnitsAwaitingRelease,
  type ClinicalReleasePolicyStatus,
  type UnitAwaitingRelease,
} from '../lib/inventory';

/**
 * What authorized staff need to know about clinical release, and nothing more.
 *
 * Deliberately not a rules editor. Sprint 7 asks for four things on this
 * screen -- whether a policy is configured, which one, what is waiting, and why
 * a release is blocked -- and for one thing to be absent: there is no
 * force-release control anywhere in this component, because there is no
 * endpoint behind one and no role entitled to use it if there were.
 *
 * The two states that matter are the two that used to be invisible. Before
 * Sprint 7 a unit went from collected to available stock on one click with no
 * testing gate at all (CL-01); now, with nothing configured, every release is
 * refused, and a console that did not say so would leave staff clicking a
 * button that always fails.
 */
export function ClinicalReleasePanel({
  organizationId,
  refreshToken,
}: {
  organizationId: string;
  /** Changes when the units list changes elsewhere, so this reloads with it. */
  refreshToken?: number;
}) {
  const { t, formatDateTime } = useTranslation();
  const [policy, setPolicy] = useState<ClinicalReleasePolicyStatus | null>(null);
  const [units, setUnits] = useState<UnitAwaitingRelease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getUnitsAwaitingRelease(organizationId);
      setPolicy(result.policy);
      setUnits(result.units);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const columns: DataTableColumn<UnitAwaitingRelease>[] = [
    { key: 'unitReference', header: t('table.reference'), render: (unit) => unit.unitReference },
    {
      key: 'bloodType',
      header: t('table.bloodType'),
      render: (unit) => `${unit.bloodType}${unit.rhFactor === 'POSITIVE' ? '+' : '-'}`,
    },
    { key: 'componentType', header: t('table.component'), render: (unit) => unit.componentType },
    {
      key: 'status',
      header: t('table.status'),
      render: (unit) => (
        <StatusBadge variant={unit.status === 'QUARANTINED' ? 'warning' : 'default'}>
          {t(`status.unit.${unit.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'collectedAt',
      header: t('table.collected'),
      render: (unit) => formatDateTime(unit.collectedAt),
    },
    {
      /**
       * Shown per unit, not buried in a detail view. A unit whose group was
       * copied from the donor's profile and a unit a laboratory typed are not
       * the same thing, and until Sprint 7 the screen could not tell them apart
       * because nothing recorded the difference (CL-05).
       */
      key: 'bloodGroupProvenance',
      header: t('ops.clinicalRelease.groupSource'),
      render: (unit) => (
        <span className="text-xs text-donor-muted">
          {t(`ops.clinicalRelease.provenance.${unit.bloodGroupProvenance}`)}
        </span>
      ),
    },
    {
      key: 'expiryKnown',
      header: t('ops.clinicalRelease.expiry'),
      render: (unit) =>
        unit.expiryKnown ? (
          <StatusBadge variant="success">{t('ops.clinicalRelease.expiryKnown')}</StatusBadge>
        ) : (
          <StatusBadge variant="warning">{t('ops.clinicalRelease.expiryUnknown')}</StatusBadge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PolicyBanner policy={policy} isLoading={isLoading} />

      {error && (
        <div className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-sm text-donor-onDangerMuted">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-donor-border/60 bg-donor-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-donor-text">
              {t('ops.clinicalRelease.awaitingTitle')}
            </h3>
            <p className="mt-1 text-sm text-donor-muted">
              {t('ops.clinicalRelease.awaitingHint')}
            </p>
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

        {!isLoading && units.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t('ops.clinicalRelease.noneAwaiting')}
            description={t('ops.clinicalRelease.noneAwaitingHint')}
          />
        ) : (
          <DataTable columns={columns} rows={units} loading={isLoading} keyExtractor={(unit) => unit.id} />
        )}
      </section>
    </div>
  );
}

/**
 * The state of the gate, at the top of the screen, before anybody clicks.
 *
 * Three cases, and the UI has to keep them apart:
 *
 * - Nothing configured. Every release will be refused. Said plainly, because a
 *   staff member who clicks Release and gets a 409 has learned the same thing
 *   the slow way.
 * - A development stand-in in force. Releases will succeed and are NOT clinical
 *   clearances. The banner says so in as many words; `developmentOnly` comes
 *   from the server rather than being inferred here, so the console and the
 *   gate cannot disagree about what counts as one.
 * - An approved production policy. Version and source shown, because "under
 *   which rules was this unit released" is what an audit asks.
 */
function PolicyBanner({
  policy,
  isLoading,
}: {
  policy: ClinicalReleasePolicyStatus | null;
  isLoading: boolean;
}) {
  const { t, formatDateTime } = useTranslation();

  if (isLoading && !policy) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-donor-border/60 bg-donor-surfaceMuted" />
    );
  }
  if (!policy) return null;

  if (!policy.policy) {
    return (
      <div
        role="status"
        className="rounded-xl border border-donor-danger/40 bg-donor-dangerMuted p-5 text-donor-onDangerMuted"
      >
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-display text-base font-semibold">
              {t('ops.clinicalRelease.notConfiguredTitle')}
            </h3>
            <p className="mt-1 text-sm">{t('ops.clinicalRelease.notConfiguredBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  const development = policy.policy.developmentOnly;

  return (
    <div
      role="status"
      className={
        development
          ? 'rounded-xl border border-donor-warning/40 bg-donor-warningMuted p-5 text-donor-onWarningMuted'
          : 'rounded-xl border border-donor-success/40 bg-donor-successMuted p-5 text-donor-onSuccessMuted'
      }
    >
      <div className="flex items-start gap-3">
        {development ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold">
            {development
              ? t('ops.clinicalRelease.developmentTitle')
              : t('ops.clinicalRelease.inForceTitle', { version: policy.policy.version })}
          </h3>
          <p className="mt-1 text-sm">
            {development
              ? t('ops.clinicalRelease.developmentBody')
              : t('ops.clinicalRelease.inForceBody', {
                  count: policy.policy.requirementCount,
                })}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-semibold">{t('ops.clinicalRelease.policyName')}</dt>
              <dd className="truncate">{policy.policy.title}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">{t('ops.clinicalRelease.policyVersion')}</dt>
              <dd>{policy.policy.version}</dd>
            </div>
            {policy.policy.approvedAt && (
              <div className="flex gap-2">
                <dt className="font-semibold">{t('ops.clinicalRelease.approvedAt')}</dt>
                <dd>{formatDateTime(policy.policy.approvedAt)}</dd>
              </div>
            )}
            {policy.policy.sourceReference && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="shrink-0 font-semibold">{t('ops.clinicalRelease.source')}</dt>
                <dd className="min-w-0">{policy.policy.sourceReference}</dd>
              </div>
            )}
          </dl>

          {policy.policy.requirements.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold">
                {t('ops.clinicalRelease.requirements', { count: policy.policy.requirementCount })}
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {policy.policy.requirements.map((requirement) => (
                  <li key={requirement.code} className="flex gap-2">
                    <span className="font-mono shrink-0">{requirement.code}</span>
                    <span className="min-w-0">{requirement.description}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Why this particular unit is not transfusable stock.
 *
 * The reason comes from the server, already resolved: the console does not
 * evaluate the policy itself, because two implementations of a safety rule are
 * one too many and the second one is always the one that drifts.
 */
export function ReleaseBlockedNotice({
  reasonCode,
  message,
  unmetRequirements,
}: {
  reasonCode: string | null;
  message: string | null;
  unmetRequirements: string[];
}) {
  const { t } = useTranslation();
  if (!reasonCode) return null;

  return (
    <div className="rounded-lg border border-donor-warning/40 bg-donor-warningMuted p-4 text-sm text-donor-onWarningMuted">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{t('ops.clinicalRelease.blockedTitle')}</p>
          <p className="mt-1">{message ?? t(`ops.clinicalRelease.reason.${reasonCode}`)}</p>
          {unmetRequirements.length > 0 && (
            <ul className="mt-2 list-inside list-disc font-mono text-xs">
              {unmetRequirements.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
