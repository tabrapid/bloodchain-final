import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Avatar from '../../components/Avatar';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

export default function ProfilePersonal() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [name, setName] = useState('Alex Johnson');
  const [email, setEmail] = useState('alex.johnson@email.com');
  const [phone, setPhone] = useState('+90 555 123 45 67');
  const [dob, setDob] = useState('1992-04-14');
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={back} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Personal Info</h1>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
        {/* Avatar */}
        <div style={{ textAlign: 'center' }}>
          <Avatar name="Alex Johnson" size={72} ring="#D85360" />
          <button style={{ background: 'none', marginTop: 10, fontSize: 13, color: '#D85360', fontWeight: 500 }}>Change photo</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InputField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <InputField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <InputField label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <InputField label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>

        <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} fullWidth>
          {saved ? <><Check size={16} /> Saved!</> : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
