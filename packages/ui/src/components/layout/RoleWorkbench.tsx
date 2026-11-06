import { ArrowRight } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';

export function getWorkArea(role: string, scope: 'hospital' | 'center') {
  if (scope === 'hospital' && role.startsWith('LAB_')) return { title: 'staff', tasks: [] };
  if (
    ![
      'HOSPITAL_ADMIN',
      'HOSPITAL_STAFF',
      'BLOOD_CENTER_ADMIN',
      'BLOOD_CENTER_STAFF',
      'LAB_TECHNICIAN',
      'LAB_REVIEWER',
      'LAB_ADMIN',
    ].includes(role)
  )
    return { title: 'staff', tasks: [] };
  if (role === 'LAB_TECHNICIAN')
    return {
      title: 'technician',
      tasks: [['laboratory', '/laboratory?status=RESULT_PENDING']],
    };
  if (role === 'LAB_REVIEWER')
    return { title: 'reviewer', tasks: [['laboratory', '/laboratory?result=ENTERED']] };
  if (role === 'LAB_ADMIN')
    return {
      title: 'labAdmin',
      tasks: [['laboratory', '/laboratory']],
    };
  const admin = role === 'HOSPITAL_ADMIN' || role === 'BLOOD_CENTER_ADMIN';
  const tasks =
    scope === 'hospital'
      ? [
          ['requests', '/requests'],
          ['shipments', '/shipments'],
          ['appointments', '/appointments'],
        ]
      : [
          ['donors', '/donors'],
          ['screening', '/screening'],
          ['inventory', '/inventory'],
          ['laboratory', '/laboratory'],
        ];
  return {
    title: admin ? 'admin' : 'staff',
    tasks: admin
      ? [['organization', '/organization'], ['analytics', '/analytics'], ...tasks]
      : tasks,
  };
}
export function RoleWorkbench({ role, scope }: { role: string; scope: 'hospital' | 'center' }) {
  const { t } = useOptionalTranslation();
  const area = getWorkArea(role, scope);
  return (
    <section className="bc-role-workbench" aria-label={t('workbench.actions')}>
      <div>
        <span>{t('workbench.role')}</span>
        <h2>{t(`workbench.${area.title}`)}</h2>
        <p>{t('workbench.source')}</p>
      </div>
      <nav aria-label={t('workbench.actions')}>
        {area.tasks.map(([label, href]) => (
          <a key={href} href={href}>
            {t(`workbench.${label}`)}
            <ArrowRight size={13} />
          </a>
        ))}
      </nav>
    </section>
  );
}
