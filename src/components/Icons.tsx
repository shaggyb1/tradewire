import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface Props {
  color: ColorValue;
  size?: number;
}

const base = (color: ColorValue) => ({ stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }) as const;

export function NewsIcon({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={16} height={16} rx={3} {...base(color)} />
      <Path d="M8 9h8M8 13h8M8 17h5" {...base(color)} />
    </Svg>
  );
}

export function InsightsIcon({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5} cy={12} r={2} {...base(color)} />
      <Circle cx={19} cy={6} r={2} {...base(color)} />
      <Circle cx={19} cy={18} r={2} {...base(color)} />
      <Path d="M7 12c5 0 5-6 10-6M7 12c5 0 5 6 10 6" {...base(color)} />
    </Svg>
  );
}

export function OptionsIcon({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20h16M4 16l5-6 4 3 7-9" {...base(color)} />
    </Svg>
  );
}

export function CalendarIcon({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={5} width={16} height={15} rx={3} {...base(color)} />
      <Path d="M4 10h16M8 3v4M16 3v4" {...base(color)} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 22 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...base(color)} />
      <Circle cx={15} cy={7} r={2} {...base(color)} />
      <Circle cx={9} cy={17} r={2} {...base(color)} />
    </Svg>
  );
}

/** TradeWire's mark: a signal rising through a wire. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width={32} height={32} rx={9} fill="#F2F0E8" />
      <Path d="M6 21h6l4-10 4 10h6" stroke="#11120F" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={16} cy={11} r={2.4} fill="#C9814F" />
    </Svg>
  );
}
