export const C = {
  bg: '#11120F',
  card: '#191A16',
  cardBorder: '#2B2C25',
  text: '#F2F0E8',
  muted: '#A5A69B',
  faint: '#85867B',
  accent: '#E5AC82',
  accentInk: '#241B15',
  high: '#F0735A',
  med: '#E3B75C',
  low: '#8FA89C',
  none: '#2B2C25',
  open: '#9ECBB7',
  chip: '#22231D',
  chipActive: '#4A3527',
  // Up / down use teal ↔ coral so they stay distinct with red-green colour
  // blindness (validated on the card surface: CVD ΔE 11.6). Always paired with ▲ / ▼.
  bull: '#5FD0C2',
  bullBg: '#14261F',
  bear: '#FF8A76',
  bearBg: '#2C1A15',
  mixedBg: '#22231D',
  /** Chart fills and lines for up / down (and puts / calls) */
  upMark: '#27A094',
  downMark: '#E5584B',
  grid: '#2B2C25',
};

export const LEVEL_COLOR = [C.none, C.low, C.med, C.high];
export const LEVEL_LABEL = ['', 'Low', 'Medium', 'High'];

/** Widest the content gets on desktop */
export const MAX_WIDTH = 1040;
