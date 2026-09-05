import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function Register() {
  const { navigate, back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('check-email');
    }, 1400);
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', padding: '12px 24px 40px', minHeight: '100%' }}>
      <button
        onClick={back}
        style={{ background: 'none', padding: '8px 0', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600 }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Join Donor.
          </h1>
          <p style={{ fontSize: 14, color: T.textMuted }}>Create your account and start saving lives.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InputField label="Full name" type="text" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} />
          <InputField label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <InputField label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <Button onClick={handleRegister} loading={loading} fullWidth>
          Create account
        </Button>

        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted }}>
          Already have an account?{' '}
          <button
            onClick={() => navigate('login')}
            style={{ background: 'none', color: '#D85360', fontWeight: 600, fontSize: 13 }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
