import type { ColorValue } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

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

/** TradeWire's mark: a market line rising through a signal pulse. Same design as the app icon. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#14323F" />
          <Stop offset="1" stopColor="#1F7F86" />
        </LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={228} fill="url(#logoBg)" />
      <Path d="M170 640 H360 L450 410 L585 735 L680 470 L748 560 L845 330" fill="none" stroke="#FFFFFF" strokeWidth={66} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={845} cy={330} r={84} fill="#7FE8C9" fillOpacity={0.28} />
      <Circle cx={845} cy={330} r={50} fill="#7FE8C9" />
    </Svg>
  );
}
