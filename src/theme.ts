export const C = {
  bg: '#EEF3F5',
  card: '#F9FBFC',
  cardBorder: '#D9E3E8',
  text: '#22303A',
  muted: '#5C6E7A',
  faint: '#5E6F7A',
  accent: '#3A7089',
  accentInk: '#FFFFFF',
  high: '#A83A29',
  med: '#86600C',
  low: '#537283',
  none: '#D9E3E8',
  open: '#17695F',
  chip: '#E3EBEF',
  chipActive: '#C7DCE7',
  // Up / down marks are teal ↔ coral so they stay distinct with red-green colour
  // blindness (validated on the card surface: CVD ΔE 10.0). Always paired with ▲ / ▼.
  bull: '#17695F',
  bullBg: '#E3F3EF',
  bear: '#A23F2F',
  bearBg: '#F8E8E4',
  mixedBg: '#E9EFF2',
  /** Chart fills and lines for up / down (and puts / calls) */
  upMark: '#0A8A7B',
  downMark: '#BC4B38',
  grid: '#D9E3E8',
};

export const LEVEL_COLOR = [C.none, C.low, C.med, C.high];
export const LEVEL_LABEL = ['', 'Low', 'Medium', 'High'];

/** Widest the content gets on desktop */
export const MAX_WIDTH = 1040;
