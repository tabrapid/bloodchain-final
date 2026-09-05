import { useState } from 'react';
import { X, ChevronLeft, Check, Clock, MapPin, Droplet, Building2 } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import { useNav, useTheme } from '../../context';
import { DARK, LIGHT } from '../../types';

type Step = 'type' | 'org' | 'date' | 'time' | 'review' | 'confirm';

const STEPS: Step[] = ['type', 'org', 'date', 'time', 'review', 'confirm'];

const DONATION_TYPES = [
  { id: 'whole', emoji: '🩸', name: 'Whole Blood', desc: 'Most needed · 450mL · 56 days minimum' },
  { id: 'plasma', emoji: '💉', name: 'Plasma', desc: '600mL · 28 days minimum' },
  { id: 'platelets', emoji: '🔬', name: 'Platelets', desc: '200mL · 7 days minimum' },
  { id: 'double', emoji: '🩺', name: 'Double Red Cells', desc: '450mL · 112 days minimum' },
];

const ORGS = [
  { id: 'acib', name: 'Acıbadem Blood Center', address: 'Kadıköy, Istanbul', dist: '1.2 km', slots: 8 },
  { id: 'kizil', name: 'Turkish Red Crescent', address: 'Üsküdar, Istanbul', dist: '2.4 km', slots: 12 },
  { id: 'gozt', name: 'Göztepe Training Hospital', address: 'Göztepe, Istanbul', dist: '3.1 km', slots: 5 },
];

const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

export default function BookingWizard() {
  const { navigate } = useNav();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState('whole');
  const [selectedOrg, setSelectedOrg] = useState('acib');
  const [selectedDay, setSelectedDay] = useState(3);
  const [selectedTime, setSelectedTime] = useState('10:30');

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const prev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const close = () => navigate('donate');

  const orgData = ORGS.find((o) => o.id === selectedOrg)!;
  const typeData = DONATION_TYPES.find((t) => t.id === selectedType)!;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      background: theme === 'dark' ? 'rgba(7, 11, 18, 0.85)' : 'rgba(239, 241, 249, 0.85)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 200,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
        {stepIndex > 0 && step !== 'confirm' ? (
          <button onClick={prev} style={{ background: 'none', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
            <ChevronLeft size={18} /> Back
          </button>
        ) : <div style={{ width: 60 }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {step === 'confirm' ? 'Done!' : `${stepIndex + 1} of ${STEPS.length - 1}`}
        </span>
        <button onClick={close} style={{ background: 'none', color: T.textMuted }}>
          <X size={20} />
        </button>
      </div>

      {/* Progress */}
      {step !== 'confirm' && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#D85360', borderRadius: 999, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column' }}>

        {/* STEP 1: Type */}
        {step === 'type' && (
          <div className="slide-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Select donation type</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>What would you like to donate today?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DONATION_TYPES.map((t) => (
                <GlassCard
                  key={t.id}
                  tier={selectedType === t.id ? 'elevated' : 'standard'}
                  style={{ borderColor: selectedType === t.id ? 'rgba(216, 83, 96, 0.45)' : undefined, cursor: 'pointer' }}
                  onClick={() => setSelectedType(t.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 28 }}>{t.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{t.desc}</div>
                    </div>
                    {selectedType === t.id && (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#D85360', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Org */}
        {step === 'org' && (
          <div className="slide-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Select location</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Choose your donation center</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ORGS.map((org) => (
                <GlassCard
                  key={org.id}
                  tier={selectedOrg === org.id ? 'elevated' : 'standard'}
                  style={{ borderColor: selectedOrg === org.id ? 'rgba(216, 83, 96, 0.45)' : undefined, cursor: 'pointer' }}
                  onClick={() => setSelectedOrg(org.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(104, 183, 209, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={18} color="#68B7D1" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{org.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> {org.address} · {org.dist}
                      </div>
                      <div style={{ fontSize: 11, color: '#63C29B', marginTop: 4 }}>{org.slots} slots available</div>
                    </div>
                    {selectedOrg === org.id && (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#D85360', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={13} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Date */}
        {step === 'date' && (
          <div className="slide-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Select date</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>When would you like to donate?</p>
            <GlassCard tier="elevated">
              <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 15, fontWeight: 700, color: T.text }}>September 2026</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: T.textMuted }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                <div />{/* Sep 1 = Tue */}
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                  const isPast = day < 30;
                  const isSelected = day === selectedDay;
                  const isDisabled = isPast && day < 30 && day < 1;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      disabled={isPast && day < 30 && day <= 0}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 8,
                        background: isSelected ? '#D85360' : 'transparent',
                        color: isSelected ? '#fff' : T.text,
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        )}

        {/* STEP 4: Time */}
        {step === 'time' && (
          <div className="slide-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Select time</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Sep {selectedDay} · {orgData.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {TIME_SLOTS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  style={{
                    padding: '12px 0',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: selectedTime === t ? 700 : 500,
                    background: selectedTime === t ? '#D85360' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${selectedTime === t ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedTime === t ? '#fff' : T.text,
                    cursor: 'pointer',
                    boxShadow: selectedTime === t ? '0 4px 12px rgba(216, 83, 96, 0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Review */}
        {step === 'review' && (
          <div className="slide-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>Review booking</h2>
            <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Confirm your appointment details</p>
            <GlassCard tier="elevated">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(216, 83, 96, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Droplet size={18} color="#D85360" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Donation Type</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{typeData.name}</div>
                  </div>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(104, 183, 209, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color="#68B7D1" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Location</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{orgData.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{orgData.address}</div>
                  </div>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99, 194, 155, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} color="#63C29B" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Date & Time</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
                      Tue, Sep {selectedDay}, 2026 · {selectedTime}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 12, lineHeight: 1.5 }}>
              By confirming, you agree to attend or cancel at least 24 hours before the appointment.
            </p>
          </div>
        )}

        {/* STEP 6: Confirm */}
        {step === 'confirm' && (
          <div className="slide-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: 32 }}>
            <div className="success-pop" style={{ marginBottom: 24 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #63C29B 0%, #3EA87E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 16px 40px rgba(99, 194, 155, 0.4)',
              }}>
                <Check size={38} color="#fff" strokeWidth={3} />
              </div>
            </div>
            <h2 style={{ fontSize: 27, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Appointment confirmed!
            </h2>
            <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 32, maxWidth: 260 }}>
              Your {typeData.name.toLowerCase()} donation at {orgData.name} on Sep {selectedDay} at {selectedTime} is confirmed.
            </p>
            <GlassCard tier="elevated" padding={16} style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Summary</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginTop: 4 }}>{typeData.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{orgData.name}</div>
                  <div style={{ fontSize: 12, color: '#63C29B', fontWeight: 500, marginTop: 2 }}>Sep {selectedDay} · {selectedTime}</div>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* CTA */}
        <div style={{ padding: '16px 0 24px' }}>
          {step !== 'confirm' ? (
            <Button onClick={next} fullWidth>
              {step === 'review' ? 'Confirm appointment' : 'Continue'}
            </Button>
          ) : (
            <Button onClick={close} fullWidth>
              Back to app
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
