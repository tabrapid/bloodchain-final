import { DataTable } from './DataTable';
import { ErrorState } from '../feedback/ErrorState';
import { StatusBadge } from './StatusBadge';
import { useOptionalTranslation } from '../../i18n';

export interface WorklistRequest {
  id: string;
  requestReference: string;
  status: string;
  priority: string;
  createdAt: string;
  requestingOrganization?: { name: string };
  fulfillingOrganization?: { name: string };
  items: {
    bloodType: string;
    rhFactor: string;
    componentType: string;
    unitsRequested: number;
    unitsApproved?: number;
    unitsFulfilled?: number;
  }[];
}
export function RequestWorklist({
  rows,
  incoming,
  loading = false,
  failed = false,
  onRetry,
}: {
  rows: WorklistRequest[];
  incoming?: boolean;
  loading?: boolean;
  failed?: boolean;
  onRetry: () => void;
}) {
  const { t, locale } = useOptionalTranslation();
  if (failed) return <ErrorState onRetry={onRetry} />;
  return (
    <section aria-busy={loading} aria-label={t('workbench.requests')}>
      <p className="bc-workbench-note">
        {t('workbench.scopeCount')}: {loading && rows.length === 0 ? '—' : rows.length}
      </p>
      <DataTable
        rows={rows}
        loading={loading && rows.length === 0}
        keyExtractor={(row) => row.id}
        columns={[
          {
            key: 'reference',
            header: t('worklist.reference'),
            sortValue: (r) => r.requestReference,
            render: (r) => (
              <a className="bc-record-link" href={`/requests/${encodeURIComponent(r.id)}`}>
                {r.requestReference}
              </a>
            ),
          },
          {
            key: 'partner',
            header: t('worklist.partner'),
            render: (r) =>
              (incoming ? r.requestingOrganization : r.fulfillingOrganization)?.name ?? '—',
          },
          {
            key: 'components',
            header: t('worklist.components'),
            render: (r) => (
              <div className="bc-component-summary">
                {r.items.map((item, index) => (
                  <span key={index}>
                    {item.bloodType}
                    {item.rhFactor === 'POSITIVE'
                      ? '+'
                      : item.rhFactor === 'NEGATIVE'
                        ? '−'
                        : '?'}{' '}
                    · {t(`medical.components.${item.componentType}`)}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: 'requested',
            header: t('worklist.requested'),
            sortValue: (r) => r.items.reduce((sum, item) => sum + item.unitsRequested, 0),
            render: (r) => r.items.reduce((sum, item) => sum + item.unitsRequested, 0),
          },
          {
            key: 'approved',
            header: t('worklist.approved'),
            render: (r) =>
              r.items.every((item) => item.unitsApproved !== undefined)
                ? r.items.reduce((sum, item) => sum + (item.unitsApproved ?? 0), 0)
                : '—',
          },
          {
            key: 'fulfilled',
            header: t('worklist.fulfilled'),
            render: (r) =>
              r.items.every((item) => item.unitsFulfilled !== undefined)
                ? r.items.reduce((sum, item) => sum + (item.unitsFulfilled ?? 0), 0)
                : '—',
          },
          {
            key: 'priority',
            header: t('worklist.priority'),
            render: (r) => (
              <StatusBadge
                variant={
                  r.priority === 'CRITICAL'
                    ? 'danger'
                    : r.priority === 'URGENT'
                      ? 'warning'
                      : 'default'
                }
              >
                {t(`worklist.${r.priority}`)}
              </StatusBadge>
            ),
          },
          {
            key: 'status',
            header: t('table.status'),
            render: (r) => (
              <StatusBadge
                variant={
                  ['REJECTED', 'CANCELLED'].includes(r.status)
                    ? 'danger'
                    : r.status === 'DELIVERED'
                      ? 'success'
                      : 'info'
                }
              >
                {t(`status.request.${r.status}`)}
              </StatusBadge>
            ),
          },
          {
            key: 'createdAt',
            header: t('workbench.time'),
            sortValue: (r) => Date.parse(r.createdAt),
            render: (r) =>
              new Intl.DateTimeFormat(locale, {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Asia/Tashkent',
              }).format(new Date(r.createdAt)),
          },
        ]}
      />
    </section>
  );
}
