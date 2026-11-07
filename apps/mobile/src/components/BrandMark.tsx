import Svg, { Path } from 'react-native-svg';
import geometry from '@bloodchain/brand/geometry';
import { useDesign } from '../design';
export interface BrandMarkProps {
  size?: number;
  wordmark?: boolean;
}
/** Same outlined geometry as every web portal and the standalone SVG downloads. */
export function BrandMark({ size = 96, wordmark = false }: BrandMarkProps) {
  const { isDark } = useDesign();
  const navy = isDark ? geometry.colors.darkNavy : geometry.colors.navy;
  const red = isDark ? geometry.colors.darkRed : geometry.colors.red;
  return (
    <Svg
      width={wordmark ? (size * 1364) / 202 : size}
      height={size}
      viewBox={wordmark ? geometry.viewBox : geometry.markViewBox}
      accessible
      accessibilityLabel={geometry.name}
    >
      {geometry.markNavy.map((d, i) => (
        <Path key={`m${i}`} d={d} fill={navy} fillRule="evenodd" />
      ))}
      {geometry.drop.map((p, i) => (
        <Path key={`d${i}`} d={p.d} fill={isDark && i === 0 ? red : p.fill} />
      ))}
      {wordmark && (
        <>
          {geometry.wordNavy.map((d, i) => (
            <Path key={`n${i}`} d={d} fill={navy} fillRule="evenodd" />
          ))}
          {geometry.wordRed.map((d, i) => (
            <Path key={`r${i}`} d={d} fill={red} fillRule="evenodd" />
          ))}
        </>
      )}
    </Svg>
  );
}
