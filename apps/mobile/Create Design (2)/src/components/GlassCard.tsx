import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../context';
import { DARK, LIGHT, RADIUS } from '../types';

/**
 * Three glass tiers per the Bloodchainga design system:
 *
 * "nav"      — Floating chrome (tab bar). Strongest blur + depth.
 * "elevated" — Hero cards, identity cards, appointment cards. Has specular.
 * "standard" — Settings rows, secondary content. No specular; lighter.
 * "danger"   — Rose-tinted variant (SOS / emergency contexts).
 */
export type GlassTier = 'nav' | 'elevated' | 'standard' | 'danger';

type RadiusKey = keyof typeof RADIUS;

interface Props {
  children: ReactNode;
  tier?: GlassTier;
  radius?: RadiusKey;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  tier = 'standard',
  radius = 'card',
  padding = 16,
  className,
  style,
  onClick,
}: Props) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;

  const r = RADIUS[radius];

  type TierMap = {
    background: string;
    border: string;
    backdropFilter: string;
    boxShadow: string;
    showSpecular: boolean;
  };

  const tiers: Record<GlassTier, TierMap> = {
    nav: {
      background: T.navGlass,
      border: T.navBorder,
      backdropFilter: T.navBlur,
      boxShadow: T.navShadow,
      showSpecular: true,
    },
    elevated: {
      background: T.elevatedGlass,
      border: T.elevatedBorder,
      backdropFilter: T.elevatedBlur,
      boxShadow: T.elevatedShadow,
      showSpecular: true,
    },
    standard: {
      background: T.standardGlass,
      border: T.standardBorder,
      backdropFilter: T.standardBlur,
      boxShadow: T.standardShadow,
      showSpecular: false,
    },
    danger: {
      background: 'rgba(216, 83, 96, 0.12)',
      border: 'rgba(216, 83, 96, 0.28)',
      backdropFilter: T.standardBlur,
      boxShadow: '0 4px 20px rgba(216, 83, 96, 0.15)',
      showSpecular: false,
    },
  };

  const t = tiers[tier];

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: r,
        backdropFilter: t.backdropFilter,
        WebkitBackdropFilter: t.backdropFilter,
        background: t.background,
        border: `1px solid ${t.border}`,
        boxShadow: t.boxShadow,
        padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {/* Specular highlight — elevated and nav only */}
      {t.showSpecular && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: T.specular,
            borderRadius: `${r}px ${r}px 0 0`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
