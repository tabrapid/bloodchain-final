'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Gauge, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, DataTable, EmptyState } from '@bloodchain/ui/components';
import type { DataTableColumn } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

import {
  deleteStockThreshold,
  getStockThresholds,
  setStockThreshold,
  type StockThreshold,
  type StockThresholdSettings,
} from '../lib/inventory';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'] as const;
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'] as const;

/**
 * Low-stock thresholds, owned by the organisation rather than by this codebase.
 *
 * The number these rows replace was `const LOW_STOCK_THRESHOLD = 5` in the
 * alert cron: one value, applied to every organisation, every blood group and
 * every component at once, and presented to staff as though the software knew
 * what a shortage was. It did not. Five units of O-negative at a republican
 * centre and five at a district hospital are not the same situation, and which
 * number matters is a property of the site.
 *
 * Nothing is suggested here and nothing is pre-filled. The form asks for a
 * number and takes whatever the operator enters.
 */
export function StockThresholds({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<StockThresholdSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StockThreshold | null>(null);

  const [form, setForm] = useState({
    scope: 'ORG' as 'ORG' | 'GROUP' | 'COMPONENT',
    bloodType: 'O',
    rhFactor: 'NEGATIVE',
    componentType: 'WHOLE_BLOOD',
    lowStockThreshold: '',
  });

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);
    try {
      setSettings(await getStockThresholds(organizationId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const threshold = Number(form.lowStockThreshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
      setError(t('ops.thresholds.invalid'));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await setStockThreshold(organizationId, {
        // A blood group is a type and an Rh factor together; the scope selector
        // is what stops half of one being sent, which would silently widen or
        // narrow the row depending on which half.
        ...(form.scope !== 'ORG'
          ? { bloodType: form.bloodType, rhFactor: form.rhFactor }
          : {}),
        ...(form.scope === 'COMPONENT' ? { componentType: form.componentType } : {}),
        lowStockThreshold: threshold,
      });
      setForm((current) => ({ ...current, lowStockThreshold: '' }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setIsSaving(true);
    try {
      await deleteStockThreshold(organizationId, pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<StockThreshold>[] = [
    {
      key: 'scope',
      header: t('ops.thresholds.scope'),
      render: (row) =>
        row.bloodType && row.rhFactor
          ? `${row.bloodType}${row.rhFactor === 'POSITIVE' ? '+' : '-'}${
              row.componentType ? ` · ${row.componentType}` : ''
            }`
          : t('ops.thresholds.organizationDefault'),
    },
    {
      key: 'lowStockThreshold',
      header: t('ops.thresholds.threshold'),
      render: (row) => t('ops.thresholds.units', { count: row.lowStockThreshold }),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setPendingDelete(row)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-donor-border px-2.5 py-1.5 text-xs font-semibold text-donor-muted transition-colors hover:text-donor-danger"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('actions.remove')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/*
        The state that used to be invisible: an organisation with no thresholds
        configured receives no low-stock alerts, which looks exactly like an
        organisation that is well stocked. In production the alert engine now
        raises LOW_STOCK_THRESHOLD_NOT_CONFIGURED rather than comparing against
        a number it made up, and this says the same thing where it can be acted
        on.
      */}
      {settings && !settings.configured && (
        <div
          role="status"
          className="rounded-xl border border-donor-warning/40 bg-donor-warningMuted p-5 text-donor-onWarningMuted"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-display text-base font-semibold">
                {t('ops.thresholds.notConfiguredTitle')}
              </h3>
              <p className="mt-1 text-sm">
                {settings.developmentFallback !== null
                  ? t('ops.thresholds.developmentFallback', { value: settings.developmentFallback })
                  : t('ops.thresholds.notConfiguredBody')}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-sm text-donor-onDangerMuted">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-donor-border/60 bg-donor-surface p-5">
        <h3 className="font-display text-lg font-semibold text-donor-text">
          {t('ops.thresholds.title')}
        </h3>
        <p className="mt-1 text-sm text-donor-muted">{t('ops.thresholds.hint')}</p>

        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="threshold-scope" className="mb-1 block text-xs font-semibold text-donor-muted">
              {t('ops.thresholds.scope')}
            </label>
            <select
              id="threshold-scope"
              value={form.scope}
              onChange={(event) =>
                setForm({ ...form, scope: event.target.value as typeof form.scope })
              }
              className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
            >
              <option value="ORG">{t('ops.thresholds.organizationDefault')}</option>
              <option value="GROUP">{t('ops.thresholds.byGroup')}</option>
              <option value="COMPONENT">{t('ops.thresholds.byComponent')}</option>
            </select>
          </div>

          {form.scope !== 'ORG' && (
            <>
              <div>
                <label htmlFor="threshold-type" className="mb-1 block text-xs font-semibold text-donor-muted">
                  {t('table.bloodType')}
                </label>
                <select
                  id="threshold-type"
                  value={form.bloodType}
                  onChange={(event) => setForm({ ...form, bloodType: event.target.value })}
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                >
                  {BLOOD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="threshold-rh" className="mb-1 block text-xs font-semibold text-donor-muted">
                  {t('table.rhFactor')}
                </label>
                <select
                  id="threshold-rh"
                  value={form.rhFactor}
                  onChange={(event) => setForm({ ...form, rhFactor: event.target.value })}
                  className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
                >
                  {RH_FACTORS.map((rh) => (
                    <option key={rh} value={rh}>
                      {rh === 'POSITIVE' ? '+' : '−'}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {form.scope === 'COMPONENT' && (
            <div>
              <label htmlFor="threshold-component" className="mb-1 block text-xs font-semibold text-donor-muted">
                {t('table.component')}
              </label>
              <select
                id="threshold-component"
                value={form.componentType}
                onChange={(event) => setForm({ ...form, componentType: event.target.value })}
                className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
              >
                {COMPONENT_TYPES.map((component) => (
                  <option key={component} value={component}>
                    {component}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="threshold-value" className="mb-1 block text-xs font-semibold text-donor-muted">
              {t('ops.thresholds.threshold')}
            </label>
            <input
              id="threshold-value"
              type="number"
              min={0}
              step={1}
              required
              value={form.lowStockThreshold}
              onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
              className="w-full rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-donor-onPrimary transition-opacity disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('actions.save')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-donor-border/60 bg-donor-surface p-5">
        {!isLoading && (settings?.thresholds.length ?? 0) === 0 ? (
          <EmptyState
            icon={Gauge}
            title={t('ops.thresholds.noneTitle')}
            description={t('ops.thresholds.noneHint')}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={settings?.thresholds ?? []}
            loading={isLoading}
            keyExtractor={(row) => row.id}
          />
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('ops.thresholds.removeTitle')}
        body={t('ops.thresholds.removeBody')}
        confirmLabel={t('actions.remove')}
        tone="danger"
        loading={isSaving}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
