export const C = {
  bg: '#0B0F14',
  card: '#131A22',
  cardBorder: '#1F2A36',
  text: '#E6EDF3',
  muted: '#8B98A5',
  faint: '#5C6773',
  accent: '#4FA3FF',
  high: '#F85149',
  med: '#D29922',
  low: '#3D8BFD',
  none: '#2B3540',
  open: '#3FB950',
  chip: '#1A2330',
  chipActive: '#2B4B73',
  // Up / down use blue ↔ red rather than green ↔ red so they stay distinct with
  // red-green colour blindness (validated on the card surface: CVD ΔE 22.9). Always paired with ▲ / ▼.
  bull: '#5AA9FF',
  bullBg: '#122338',
  bear: '#FF6B6B',
  bearBg: '#2D1517',
  mixedBg: '#1E2329',
  /** Chart fills and lines for up / down (and puts / calls) */
  upMark: '#3A8EE6',
  downMark: '#E5584B',
  grid: '#26313D',
};

export const LEVEL_COLOR = [C.none, C.low, C.med, C.high];
export const LEVEL_LABEL = ['', 'Low', 'Medium', 'High'];
