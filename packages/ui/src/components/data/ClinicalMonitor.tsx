import { ArrowUpRight, Beaker, Package, Truck } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';

interface LaboratorySummary {
  totalTests: number;
  completedTests: number;
  pendingTests: number;
}
interface InventorySummary {
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  quarantinedUnits: number;
}
interface ShipmentSummary {
  active: number;
  delivered: number;
  delayed: number;
}

/** Operational indicators are calculated only from API summaries. Empty data is not a healthy status. */
export function ClinicalMonitor({
  laboratory,
  inventory,
  shipments,
  loading = false,
}: {
  laboratory: LaboratorySummary | null;
  inventory: InventorySummary | null;
  shipments: ShipmentSummary | null;
  loading?: boolean;
}) {
  const { t } = useOptionalTranslation();
  const completion =
    !loading && laboratory && laboratory.totalTests > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((laboratory.completedTests / laboratory.totalTests) * 100)),
        )
      : null;
  const count = (value: number | undefined) =>
    loading || value == null ? '—' : value.toLocaleString();
  const stock = [
    { label: t('clinical.available'), value: inventory?.availableUnits, tone: 'available' },
    { label: t('clinical.reserved'), value: inventory?.reservedUnits, tone: 'reserved' },
    { label: t('clinical.quarantine'), value: inventory?.quarantinedUnits, tone: 'quarantine' },
  ];
  return (
    <section className="bc-monitor-grid" aria-label={t('clinical.monitoring')} aria-busy={loading}>
      <article className="bc-monitor-panel">
        <div className="bc-panel-heading">
          <span>
            <Beaker size={16} aria-hidden="true" />
            {t('clinical.laboratory')}
          </span>
          <a href="/laboratory" aria-label={t('clinical.laboratory')}>
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div
          className="bc-gauge"
          role="img"
          aria-label={`${t('clinical.completion')}: ${completion == null ? t('clinical.noData') : `${completion}%`}`}
        >
          <svg viewBox="0 0 240 140" aria-hidden="true">
            <path
              d="M 20 120 A 100 100 0 0 1 220 120"
              pathLength="100"
              className="bc-gauge-track"
            />
            {completion != null && (
              <path
                d="M 20 120 A 100 100 0 0 1 220 120"
                pathLength="100"
                strokeDasharray={`${completion} 100`}
                className="bc-gauge-value"
              />
            )}
          </svg>
          <div>
            <strong>{completion == null ? '—' : `${completion}%`}</strong>
            <span>{t('clinical.completion')}</span>
          </div>
        </div>
        <div className="bc-monitor-pair">
          <span>
            {t('clinical.completedTests')}
            <b>{count(laboratory?.completedTests)}</b>
          </span>
          <span>
            {t('clinical.queue')}
            <b>{count(laboratory?.pendingTests)}</b>
          </span>
        </div>
      </article>
      <article className="bc-monitor-panel">
        <div className="bc-panel-heading">
          <span>
            <Package size={16} aria-hidden="true" />
            {t('clinical.inventory')}
          </span>
          <a href="/inventory" aria-label={t('clinical.inventory')}>
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="bc-stock-total">
          <strong>{count(inventory?.totalUnits)}</strong>
          <span>{t('clinical.total')}</span>
        </div>
        <div className="bc-stock-bar" aria-hidden="true">
          {stock.map((item) => (
            <span
              key={item.tone}
              className={`bc-tone-${item.tone}`}
              style={{
                flex:
                  !loading && inventory?.totalUnits
                    ? Math.max(0, item.value ?? 0) / inventory.totalUnits
                    : 0,
              }}
            />
          ))}
        </div>
        <dl className="bc-stock-list">
          {stock.map((item) => (
            <div key={item.tone}>
              <dt>
                <i className={`bc-tone-${item.tone}`} />
                {item.label}
              </dt>
              <dd>{count(item.value)}</dd>
            </div>
          ))}
        </dl>
      </article>
      <article className="bc-monitor-panel">
        <div className="bc-panel-heading">
          <span>
            <Truck size={16} aria-hidden="true" />
            {t('clinical.distribution')}
          </span>
          <a href="/shipments" aria-label={t('clinical.distribution')}>
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="bc-distribution-count">
          <strong>{count(shipments?.active)}</strong>
          <span>{t('clinical.activeShipments')}</span>
        </div>
        <div className="bc-distribution-row">
          <span>{t('clinical.delivered')}</span>
          <b>{count(shipments?.delivered)}</b>
        </div>
        <div
          className={`bc-distribution-row ${!loading && shipments && shipments.delayed > 0 ? 'bc-delayed' : ''}`}
        >
          <span>{t('clinical.delayed')}</span>
          <b>{count(shipments?.delayed)}</b>
        </div>
      </article>
    </section>
  );
}
