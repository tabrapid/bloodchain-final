import { Droplet } from 'lucide-react';
import Button from '../../components/Button';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function Welcome() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  return (
    <div className="animate-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 28px 48px',
      minHeight: '100%',
      textAlign: 'center',
    }}>
      {/* App icon */}
      <div style={{
        width: 88,
        height: 88,
        borderRadius: 26,
        background: 'linear-gradient(135deg, #D85360 0%, #8E4A75 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 16px 48px rgba(216, 83, 96, 0.45)',
        marginBottom: 36,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '44%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
          borderRadius: '26px 26px 0 0',
        }} />
        <Droplet size={42} color="#fff" fill="#fff" style={{ position: 'relative' }} />
      </div>

      {/* Wordmark */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: T.textMuted,
        marginBottom: 20,
      }}>
        Donor
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 38,
        fontWeight: 800,
        color: T.text,
        lineHeight: 1.1,
        letterSpacing: '-0.03em',
        marginBottom: 16,
        maxWidth: 280,
      }}>
        Care that moves with you.
      </h1>

      <p style={{
        fontSize: 15,
        color: T.textMuted,
        lineHeight: 1.6,
        maxWidth: 280,
        marginBottom: 56,
        letterSpacing: '-0.01em',
      }}>
        Track your donations, monitor your health, and connect with your community — all in one place.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
        <Button onClick={() => navigate('login')} fullWidth>
          Sign in
        </Button>
        <Button variant="ghost" onClick={() => navigate('register')} fullWidth>
          Create an account
        </Button>
      </div>

      {/* Legal */}
      <p style={{
        marginTop: 32,
        fontSize: 11,
        color: T.textMuted,
        opacity: 0.7,
        lineHeight: 1.5,
        maxWidth: 260,
      }}>
        By continuing you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
