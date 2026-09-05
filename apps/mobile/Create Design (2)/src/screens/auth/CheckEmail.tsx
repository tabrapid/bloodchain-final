import { Mail } from 'lucide-react';
import Button from '../../components/Button';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function CheckEmail() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div className="animate-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 28px',
      minHeight: '100%',
      textAlign: 'center',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 24,
        background: 'rgba(104, 183, 209, 0.2)',
        border: '1px solid rgba(104, 183, 209, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
      }}>
        <Mail size={36} color="#68B7D1" strokeWidth={1.5} />
      </div>

      <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 12 }}>
        Check your inbox
      </h1>
      <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, maxWidth: 280, marginBottom: 40 }}>
        We sent a verification link to your email. Click it to activate your account.
      </p>

      <Button onClick={() => navigate('home')} fullWidth>
        Continue to app
      </Button>

      <button
        style={{ background: 'none', marginTop: 20, fontSize: 13, color: '#D85360', fontWeight: 500 }}
      >
        Resend email
      </button>
    </div>
  );
}
