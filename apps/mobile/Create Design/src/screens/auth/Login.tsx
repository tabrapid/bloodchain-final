import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function Login() {
  const { navigate, back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('home');
    }, 1200);
  };

  return (
    <div className="animate-in" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 24px 40px',
      minHeight: '100%',
    }}>
      {/* Back */}
      <button
        onClick={back}
        style={{ background: 'none', padding: '8px 0', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600 }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Welcome back.
          </h1>
          <p style={{ fontSize: 14, color: T.textMuted }}>Sign in to continue saving lives.</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InputField
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ? ' ' : undefined}
          />
          <InputField
            label="Password"
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
            trailing={
              <button
                onClick={() => setShowPw(!showPw)}
                style={{ background: 'none', color: T.textMuted, display: 'flex' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
        </div>

        {/* Forgot */}
        <button style={{ background: 'none', alignSelf: 'flex-end', marginTop: -20, fontSize: 13, color: '#D85360', fontWeight: 500 }}>
          Forgot password?
        </button>

        {/* Submit */}
        <Button onClick={handleLogin} loading={loading} fullWidth>
          Sign in
        </Button>

        {/* Register link */}
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted }}>
          Don't have an account?{' '}
          <button
            onClick={() => navigate('register')}
            style={{ background: 'none', color: '#D85360', fontWeight: 600, fontSize: 13 }}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
