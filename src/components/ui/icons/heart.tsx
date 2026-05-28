import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

export function Heart({ color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 4.8 5.4 4.8c2 0 3.4 1.1 4.6 2.7 1.2-1.6 2.6-2.7 4.6-2.7 3.4 0 5 3.6 3.4 6.9C19.5 16.4 12 21 12 21Z"
        fill={color}
      />
    </Svg>
  );
}
