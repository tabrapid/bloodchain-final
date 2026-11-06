'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DataTable, ErrorState, LoadingState, StatusBadge } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';
import {
  getLaboratoryResult,
  type LaboratoryAppointment,
  type LaboratoryResult,
} from '../lib/laboratory';

export function LaboratoryInspector({
  appointment,
  organizationId,
  onClose,
}: {
  appointment: LaboratoryAppointment;
  organizationId: string;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const [result, setResult] = useState<LaboratoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resultId = appointment.laboratoryResult?.id;
  useEffect(() => {
    let current = true;
    setResult(null);
    setFailed(false);
    if (!resultId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getLaboratoryResult(organizationId, resultId)
      .then((data) => {
        if (current) setResult(data);
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [organizationId, resultId, attempt, appointment.id, appointment.laboratoryResult?.status]);
  const time = (value?: string) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'Asia/Tashkent',
        }).format(new Date(value))
      : t('workbench.notRecorded');
  return (
    <aside className="bc-lab-inspector" aria-label={t('workbench.selected')}>
      <header>
        <div>
          <span>{t('workbench.sampleRef')}</span>
          <h2>{appointment.referenceNumber}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t('workbench.close')}>
          <X size={18} />
        </button>
      </header>
      <div className="bc-lab-identity">
        <strong>
          {appointment.donor.firstName} {appointment.donor.lastName}
        </strong>
        <span>{t(`status.appointment.${appointment.status}`)}</span>
      </div>
      {loading ? (
        <LoadingState />
      ) : failed ? (
        <ErrorState title={t('workbench.detailError')} onRetry={() => setAttempt((n) => n + 1)} />
      ) : result && result.id === resultId ? (
        <>
          <h3>{t('workbench.resultHistory')}</h3>
          <ol className="bc-result-timeline">
            {[
              { label: 'entered', date: result.performedAt, actor: result.performedBy },
              { label: 'reviewed', date: result.reviewedAt, actor: result.reviewedBy },
              { label: 'published', date: result.publishedAt, actor: result.publishedBy },
            ].map((step) => (
              <li key={step.label} data-recorded={!!step.date}>
                <strong>{t(`workbench.${step.label}`)}</strong>
                <dl>
                  <dt>{t('workbench.time')}</dt>
                  <dd>{time(step.date)}</dd>
                  <dt>{t('workbench.actor')}</dt>
                  <dd>{step.actor ?? t('workbench.notRecorded')}</dd>
                </dl>
              </li>
            ))}
          </ol>
          <h3>{result.testType.name}</h3>
          <DataTable
            rows={result.items}
            keyExtractor={(item) => item.id}
            columns={[
              {
                key: 'parameter',
                header: t('workbench.parameter'),
                render: (item) => item.parameter.name,
              },
              {
                key: 'value',
                header: t('workbench.value'),
                render: (item) => item.value ?? String(item.numericValue ?? '—'),
              },
              { key: 'unit', header: t('workbench.unit') },
              {
                key: 'reference',
                header: t('workbench.reference'),
                render: (item) => `${item.referenceMin ?? '—'} – ${item.referenceMax ?? '—'}`,
              },
              {
                key: 'flag',
                header: t('workbench.flag'),
                render: (item) => (
                  <StatusBadge
                    variant={
                      item.flag === 'CRITICAL'
                        ? 'danger'
                        : ['LOW', 'HIGH', 'ABNORMAL'].includes(item.flag)
                          ? 'warning'
                          : 'default'
                    }
                  >
                    {t(`medical.resultFlagsByCode.${item.flag}`)}
                  </StatusBadge>
                ),
              },
            ]}
          />
        </>
      ) : (
        <p className="bc-workbench-note">{t('workbench.noResult')}</p>
      )}
      <p className="bc-workbench-note">{t('workbench.unknownStep')}</p>
    </aside>
  );
}
