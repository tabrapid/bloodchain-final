'use client';
import { useCallback, useEffect, useState } from 'react';
import { DataTable, ErrorState } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';
import { getLaboratoryAppointments, type LaboratoryAppointment } from '../lib/laboratory';
export function LaboratoryQueue({
  organizationId,
  role,
}: {
  organizationId: string;
  role: string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LaboratoryAppointment[]>([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLaboratoryAppointments(organizationId);
      setRows(data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);
  useEffect(() => {
    void load();
  }, [load]);
  const queue = rows.filter((row) =>
    role === 'LAB_REVIEWER'
      ? row.laboratoryResult?.status === 'ENTERED'
      : role === 'LAB_TECHNICIAN'
        ? ['CHECKED_IN', 'IN_PROGRESS', 'RESULT_PENDING'].includes(row.status)
        : true,
  );
  return (
    <section aria-label={t('workbench.queue')}>
      <h2 className="mb-3 text-base font-semibold">{t('workbench.queue')}</h2>
      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <>
          <p className="bc-workbench-note">
            {t('workbench.scopeCount')}: {loading ? '—' : queue.length}
          </p>
          <DataTable
            loading={loading}
            rows={queue}
            keyExtractor={(a) => a.id}
            columns={[
              {
                key: 'referenceNumber',
                header: t('workbench.sampleRef'),
                sortValue: (a) => a.referenceNumber,
                render: (a) => (
                  <a href={`/laboratory?ref=${encodeURIComponent(a.id)}`}>{a.referenceNumber}</a>
                ),
              },
              {
                key: 'donor',
                header: t('table.donor'),
                render: (a) => `${a.donor.firstName} ${a.donor.lastName}`,
              },
              {
                key: 'status',
                header: t('table.status'),
                render: (a) => t(`status.appointment.${a.status}`),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}
