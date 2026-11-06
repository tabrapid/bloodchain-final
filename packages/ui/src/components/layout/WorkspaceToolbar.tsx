import { Building2, ListFilter, Printer } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';

export function WorkspaceToolbar({
  organizationName,
  compact,
  onCompactChange,
}: {
  organizationName?: string;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}) {
  const { t } = useOptionalTranslation();
  return (
    <div className="bc-workspace-toolbar">
      <div className="bc-workspace-location">
        <Building2 size={15} aria-hidden="true" />
        <span>{organizationName ?? t('clinical.workspace')}</span>
      </div>
      <div className="bc-workspace-tools">
        <button
          type="button"
          aria-label={t('clinical.compact')}
          aria-pressed={compact}
          onClick={() => onCompactChange(!compact)}
        >
          <ListFilter size={15} aria-hidden="true" />
          <span>{t('clinical.compact')}</span>
        </button>
        <button type="button" aria-label={t('clinical.print')} onClick={() => window.print()}>
          <Printer size={15} aria-hidden="true" />
          <span>{t('clinical.print')}</span>
        </button>
      </div>
    </div>
  );
}
