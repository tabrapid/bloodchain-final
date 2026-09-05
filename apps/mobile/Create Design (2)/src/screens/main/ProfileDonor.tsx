import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import SectionHeader from '../../components/SectionHeader';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileDonor() {
  const { back } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [bloodType, setBloodType] = useState('O+');
  const [city, setCity] = useState('Istanbul');
  const [district, setDistrict] = useState('Kadıköy');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: '8px 20px 20px' }}>
        <button onClick={back} style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#D85360', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: 27, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>Donor Profile</h1>
        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>Update your donor information</p>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

        <div>
          <SectionHeader label="Blood Type" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                onClick={() => setBloodType(bt)}
                style={{
                  padding: '12px 0',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: bloodType === bt ? 800 : 500,
                  background: bloodType === bt ? '#D85360' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${bloodType === bt ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                  color: bloodType === bt ? '#fff' : T.text,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader label="Location" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, display: 'block', marginBottom: 6 }}>City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: T.text,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, display: 'block', marginBottom: 6 }}>District</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: T.text,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          </GlassCard>
        </div>

        <div>
          <SectionHeader label="Donor Preferences" />
          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['Whole Blood', 'Plasma', 'Platelets', 'Double Red Cells'].map((t) => (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: T.text }}>{t}</span>
                  <div style={{ width: 44, height: 24, borderRadius: 999, background: '#D85360', position: 'relative', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <Button onClick={handleSave} fullWidth>
          {saved ? (
            <><Check size={16} /> Saved!</>
          ) : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
