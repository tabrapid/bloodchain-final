import { useTheme } from '../context';
import { COLORS } from '../types';

export default function ColorBlooms() {
  const { theme } = useTheme();
  const opacity = theme === 'dark' ? 0.24 : 0.16;
  const blur = theme === 'dark' ? '90px' : '100px';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div
        className="bloom-1"
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: COLORS.primary,
          opacity,
          filter: `blur(${blur})`,
          top: -80,
          left: -60,
        }}
      />
      <div
        className="bloom-2"
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: COLORS.secondary,
          opacity,
          filter: `blur(${blur})`,
          top: '38%',
          right: -70,
        }}
      />
      <div
        className="bloom-3"
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: COLORS.ai,
          opacity,
          filter: `blur(${blur})`,
          bottom: -60,
          left: '15%',
        }}
      />
    </div>
  );
}
