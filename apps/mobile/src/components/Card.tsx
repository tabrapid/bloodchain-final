import { PropsWithChildren } from 'react';
import { GlassCard, GlassCardProps } from './GlassCard';

/**
 * `Card` is the glass panel. It used to be a flat opaque surface, which meant
 * the ~29 screens built on it kept rendering as solid boxes after the Liquid
 * Glass redesign -- the new look only reached the handful of screens that had
 * explicitly reached for `GlassCard`. Since the app's design language *is*
 * glass now, the default card is the glass one, and both names render the same
 * surface.
 */
export function Card({ children, style, ...props }: PropsWithChildren<GlassCardProps>) {
  return (
    <GlassCard style={style} {...props}>
      {children}
    </GlassCard>
  );
}
