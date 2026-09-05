import { useTheme } from '../context';
import { DARK, LIGHT } from '../types';

interface Props {
  label: string;
  action?: { label: string; onClick: () => void };
}

export default function SectionHeader({ label, action }: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: T.text,
        opacity: 0.55,
      }}>
        {label}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: 'none',
            fontSize: 12,
            fontWeight: 500,
            color: '#D85360',
            padding: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
