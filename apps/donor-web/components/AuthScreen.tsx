'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, ArrowLeft, ShieldCheck } from 'lucide-react';
import { authAction, login } from '../lib/api/auth';
import { Field, FormMessage } from './common';
type Mode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'
  | 'verify-email'
  | 'phone'
  | 'code'
  | 'details'
  | 'resend';
export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [purpose, setPurpose] = useState<'REGISTRATION' | 'PASSWORD_RESET'>('REGISTRATION');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get('mode');
    if (m === 'reset' || m === 'verify-email') {
      setMode(m);
      setToken(q.get('token') ?? '');
    }
  }, []);
  const change = (next: Mode) => {
    setMode(next);
    setError('');
    setSuccess('');
    setPassword('');
  };
  const titles: Record<Mode, string> = {
    resend: 'Tasdiqlash xatini qayta yuborish',
    login: 'Donor kabinetiga kirish',
    register: 'Donor sifatida ro‘yxatdan o‘tish',
    forgot: 'Parolni tiklash',
    reset: 'Yangi parol o‘rnatish',
    'verify-email': 'Emailni tasdiqlash',
    phone: 'Telefon orqali ro‘yxatdan o‘tish',
    code: 'SMS kodni tasdiqlash',
    details: 'Ro‘yxatdan o‘tishni yakunlash',
  };
  return (
    <main className="donor-auth">
      <section className="donor-auth-story">
        <div className="donor-auth-brand">
          <Droplet size={30} />
          <strong>BloodChain</strong>
        </div>
        <span className="donor-eyebrow">YAGONA DONORLIK EKOTIZIMI</span>
        <h1>
          Yaxshilik sizdan
          <br />
          boshlanadi.
        </h1>
        <p>
          Donatsiyalaringiz, tahlillaringiz va sog‘lig‘ingiz — barchasi bitta shaxsiy kabinetda.
        </p>
        <div className="donor-auth-assurance">
          <ShieldCheck size={22} />
          <span>
            Mobil ilovadagi akkauntingiz bilan kiring.
            <br />
            Ma’lumotlaringiz yagona tizimda saqlanadi.
          </span>
        </div>
      </section>
      <section className="donor-auth-form">
        <div className="donor-auth-form-inner">
          <span className="donor-eyebrow">SHAXSIY KABINET</span>
          <h2>{titles[mode]}</h2>
          <p className="donor-muted">Donorlik faoliyatingizni qulay boshqaring.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              setSuccess('');
              try {
                if (mode === 'login') {
                  await login(identifier, password);
                  router.replace('/');
                }
                if (mode === 'register') {
                  await authAction('register', {
                    email: identifier,
                    password,
                    firstName,
                    lastName,
                  });
                  setSuccess('Tasdiqlash havolasi emailingizga yuborildi.');
                }
                if (mode === 'resend') {
                  await authAction('resend-verification', { email: identifier });
                  setSuccess('Akkaunt mavjud bo‘lsa, tasdiqlash havolasi yuboriladi.');
                }
                if (mode === 'forgot') {
                  const r = await authAction('forgot-password', { email: identifier });
                  setSuccess(r.message ?? 'Akkaunt mavjud bo‘lsa, tiklash havolasi yuboriladi.');
                }
                if (mode === 'reset') {
                  await authAction('reset-password', { token, newPassword: password });
                  change('login');
                  setSuccess('Parol yangilandi. Qayta kiring.');
                }
                if (mode === 'verify-email') {
                  await authAction('verify-email', { token });
                  router.replace('/');
                }
                if (mode === 'phone') {
                  await authAction('phone/request-code', {
                    phone: identifier,
                    purpose,
                    locale: 'uz',
                  });
                  change('code');
                }
                if (mode === 'code') {
                  const r = await authAction<{ verificationToken?: string; resetToken?: string }>(
                    'phone/verify-code',
                    { phone: identifier, purpose, code },
                  );
                  setToken(r.verificationToken ?? r.resetToken ?? '');
                  change(purpose === 'REGISTRATION' ? 'details' : 'reset');
                }
                if (mode === 'details') {
                  await authAction('register-phone', {
                    verificationToken: token,
                    password,
                    firstName,
                    lastName,
                  });
                  router.replace('/');
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'So‘rov bajarilmadi');
              } finally {
                setBusy(false);
              }
            }}
          >
            {['login', 'register', 'forgot', 'phone', 'resend'].includes(mode) && (
              <Field
                label={
                  mode === 'phone'
                    ? 'Telefon (+998…)'
                    : mode === 'login'
                      ? 'Telefon yoki email'
                      : 'Email'
                }
              >
                <input
                  required
                  type={
                    mode === 'register' || mode === 'forgot' || mode === 'resend'
                      ? 'email'
                      : mode === 'phone'
                        ? 'tel'
                        : 'text'
                  }
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </Field>
            )}
            {['register', 'details'].includes(mode) && (
              <div className="donor-form-grid">
                <Field label="Ism">
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Familiya">
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
            )}
            {['login', 'register', 'reset', 'details'].includes(mode) && (
              <Field label="Parol">
                <input
                  required
                  type="password"
                  minLength={mode === 'login' ? 1 : 8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {mode === 'code' && (
              <Field label="Olti xonali SMS kod">
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
            )}
            {mode === 'verify-email' && !token && (
              <p role="alert">Tasdiqlash havolasini emailingizdan oching.</p>
            )}
            <FormMessage error={error} success={success} />
            <button
              className="primary donor-wide"
              disabled={busy || (mode === 'verify-email' && !token)}
            >
              {busy ? 'Kutilmoqda…' : mode === 'login' ? 'Kirish' : 'Davom etish'}
            </button>
          </form>
          <div className="donor-auth-links">
            {mode === 'login' ? (
              <>
                <button onClick={() => change('forgot')}>Parolni unutdingizmi?</button>
                <button onClick={() => change('resend')}>Tasdiqlash xatini qayta yuborish</button>
                <button onClick={() => change('register')}>Email orqali ro‘yxatdan o‘tish</button>
                <button
                  onClick={() => {
                    setPurpose('REGISTRATION');
                    change('phone');
                  }}
                >
                  Telefon orqali ro‘yxatdan o‘tish
                </button>
                <button
                  onClick={() => {
                    setPurpose('PASSWORD_RESET');
                    change('phone');
                  }}
                >
                  SMS orqali parolni tiklash
                </button>
              </>
            ) : (
              <button onClick={() => change('login')}>
                <ArrowLeft size={14} /> Kirishga qaytish
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
