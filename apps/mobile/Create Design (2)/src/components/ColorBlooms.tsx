import { useTheme } from '../context';
import { COLORS } from '../types';

/**
 * Ambient background blooms.
 * Positioned off-canvas edges so they add atmosphere without
 * competing with foreground content — especially the text-heavy center.
 */
export default function ColorBlooms() {
  const { theme } = useTheme();

  // Dark: enough presence to feel dimensional; light: very soft tint
  const opacity = theme === 'dark' ? 0.28 : 0.14;
  const size = 280;
  const blur = theme === 'dark' ? '100px' : '110px';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {/* Rose — top-left corner, near the hero region */}
      <div
        className="bloom-1"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          background: COLORS.primary,
          opacity,
          filter: `blur(${blur})`,
          top: -size * 0.45,
          left: -size * 0.35,
        }}
      />
      {/* Blue — mid-right edge */}
      <div
        className="bloom-2"
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: '50%',
          background: COLORS.secondary,
          opacity: opacity * 0.75,
          filter: `blur(${blur})`,
          top: '35%',
          right: -size * 0.45,
        }}
      />
      {/* Purple — lower-left, subtle */}
      <div
        className="bloom-3"
        style={{
          position: 'absolute',
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: '50%',
          background: COLORS.ai,
          opacity: opacity * 0.65,
          filter: `blur(${blur})`,
          bottom: -size * 0.4,
          left: '10%',
        }}
      />
    </div>
  );
}
