import geometry from '@bloodchain/brand/geometry';
import { cn } from './cn';
export interface BrandLogoProps {
  variant?: 'wordmark' | 'mark';
  dark?: boolean;
  className?: string;
  /** Omit the accessible name when an enclosing link already names the brand. */
  decorative?: boolean;
}
/** Outlined artwork reconstructed from the supplied Bloodchain identity. */
export function BrandLogo({
  variant = 'wordmark',
  dark = false,
  className,
  decorative = false,
}: BrandLogoProps) {
  const navy = dark ? geometry.colors.darkNavy : geometry.colors.navy;
  const red = dark ? geometry.colors.darkRed : geometry.colors.red;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={variant === 'mark' ? geometry.markViewBox : geometry.viewBox}
      className={cn('bc-brand-logo', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : geometry.name}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {geometry.markNavy.map((d, i) => (
        <path key={`m${i}`} d={d} fill={navy} fillRule="evenodd" />
      ))}
      {geometry.drop.map((p, i) => (
        <path key={`d${i}`} d={p.d} fill={dark && i === 0 ? red : p.fill} />
      ))}
      {variant === 'wordmark' && (
        <>
          {geometry.wordNavy.map((d, i) => (
            <path key={`n${i}`} d={d} fill={navy} fillRule="evenodd" />
          ))}
          {geometry.wordRed.map((d, i) => (
            <path key={`r${i}`} d={d} fill={red} fillRule="evenodd" />
          ))}
        </>
      )}
    </svg>
  );
}
