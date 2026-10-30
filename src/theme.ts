export const C = {
  bg: '#1A1C12',
  card: '#24271A',
  cardBorder: '#3A3E2A',
  text: '#F3F1E2',
  muted: '#ABAD96',
  faint: '#8E907B',
  accent: '#D4CE8C',
  accentInk: '#2B2A0C',
  high: '#EF8A6C',
  med: '#E2B66A',
  low: '#9DB08C',
  none: '#3A3E2A',
  open: '#8FD3A8',
  chip: '#2E3122',
  chipActive: '#55552F',
  // Up / down marks are teal ↔ coral so they stay distinct with red-green colour
  // blindness (validated on the card surface: CVD ΔE 10.5). Always paired with ▲ / ▼.
  bull: '#8FD3A8',
  bullBg: '#223425',
  bear: '#EFA082',
  bearBg: '#3B2A1E',
  mixedBg: '#2E3122',
  /** Chart fills and lines for up / down (and puts / calls) */
  upMark: '#2F9E8A',
  downMark: '#E0654A',
  grid: '#3A3E2A',
};

export const LEVEL_COLOR = [C.none, C.low, C.med, C.high];
export const LEVEL_LABEL = ['', 'Low', 'Medium', 'High'];

/** Widest the content gets on desktop */
export const MAX_WIDTH = 1040;
