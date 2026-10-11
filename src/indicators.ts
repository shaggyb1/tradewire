import type { Tick } from './nse';

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface Reading {
  label: string;
  value: string;
  /** 1 = reads upward, -1 = downward, 0 = neutral */
  dir: -1 | 0 | 1;
  note: string;
}

export interface Intraday {
  last: number;
  prevClose: number;
  change: number;
  pct: number;
  dayHigh: number;
  dayLow: number;
  candles: Candle[];
  readings: Reading[];
}

const IST_MS = 330 * 60000;
const DAY_MS = 24 * 3600 * 1000;
/** 9:15 AM and 3:30 PM IST, in minutes after midnight */
const SESSION_START_MIN = 555;
const SESSION_END_MIN = 930;

/** Groups minute ticks into N-minute candles (normal session 9:15–15:30 IST only). */
export function toCandles(ticks: Tick[], minutes = 5): Candle[] {
  const size = minutes * 60000;
  const out: Candle[] = [];
  for (const { t, price, normal } of ticks) {
    // NSE flags only part of the pre-open, and keeps ticking in the post-close session
    const mins = ((t + IST_MS) % DAY_MS) / 60000;
    if (!normal || mins < SESSION_START_MIN || mins >= SESSION_END_MIN) continue;
    const bucket = Math.floor(t / size) * size;
    const last = out[out.length - 1];
    if (last && last.t === bucket) {
      last.h = Math.max(last.h, price);
      last.l = Math.min(last.l, price);
      last.c = price;
    } else {
      out.push({ t: bucket, o: price, h: price, l: price, c: price });
    }
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** Wilder's RSI. Returns NaN until there are enough values. */
export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

/** Supertrend direction on candles: 1 = up, -1 = down. */
export function supertrend(candles: Candle[], period = 10, mult = 3): { dir: 1 | -1; line: number } | null {
  if (candles.length <= period) return null;
  const tr = candles.map((c, i) => (i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c))));
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let upper = 0;
  let lower = 0;
  let dir: 1 | -1 = 1;
  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    const mid = (candles[i].h + candles[i].l) / 2;
    const bu = mid + mult * atr;
    const bl = mid - mult * atr;
    const prevClose = candles[i - 1].c;
    upper = i === period || bu < upper || prevClose > upper ? bu : upper;
    lower = i === period || bl > lower || prevClose < lower ? bl : lower;
    if (candles[i].c > upper) dir = 1;
    else if (candles[i].c < lower) dir = -1;
  }
  return { dir, line: dir === 1 ? lower : upper };
}

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Standard intraday readings on 5-minute candles. Descriptive only — not signals. */
export function intraday(ticks: Tick[], prevClose: number): Intraday | null {
  const candles = toCandles(ticks, 5);
  if (!candles.length) return null;
  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const dayHigh = Math.max(...candles.map((c) => c.h));
  const dayLow = Math.min(...candles.map((c) => c.l));
  const readings: Reading[] = [];

  // EMA 9 / 21
  if (closes.length >= 21) {
    const e9 = ema(closes, 9).at(-1)!;
    const e21 = ema(closes, 21).at(-1)!;
    const up = e9 > e21;
    readings.push({
      label: 'EMA 9 / 21',
      value: `${fmt(e9)} / ${fmt(e21)}`,
      dir: up ? 1 : -1,
      note: up ? 'Fast average above slow — short-term uptrend' : 'Fast average below slow — short-term downtrend',
    });
  }

  // RSI 14
  const r = rsi(closes, 14);
  if (!Number.isNaN(r)) {
    readings.push({
      label: 'RSI 14',
      value: r.toFixed(1),
      dir: r >= 60 ? 1 : r <= 40 ? -1 : 0,
      note: r >= 70 ? 'Overbought zone (above 70)' : r <= 30 ? 'Oversold zone (below 30)' : r >= 60 ? 'Bullish momentum' : r <= 40 ? 'Bearish momentum' : 'Neutral momentum',
    });
  }

  // Supertrend (10, 3)
  const st = supertrend(candles);
  if (st) {
    readings.push({
      label: 'Supertrend 10,3',
      value: fmt(st.line),
      dir: st.dir,
      note: st.dir === 1 ? 'Price above Supertrend — trend up' : 'Price below Supertrend — trend down',
    });
  }

  // Opening range (first 15 minutes: 9:15–9:30)
  const orCandles = candles.slice(0, 3);
  if (candles.length > 3) {
    const orH = Math.max(...orCandles.map((c) => c.h));
    const orL = Math.min(...orCandles.map((c) => c.l));
    const dir = last > orH ? 1 : last < orL ? -1 : 0;
    readings.push({
      label: 'Opening range',
      value: `${fmt(orL)} – ${fmt(orH)}`,
      dir,
      note: dir === 1 ? 'Trading above the first 15-min high' : dir === -1 ? 'Trading below the first 15-min low' : 'Inside the first 15-min range',
    });
  }

  // Position in day's range
  const pos = dayHigh > dayLow ? (last - dayLow) / (dayHigh - dayLow) : 0.5;
  readings.push({
    label: 'Day range',
    value: `${Math.round(pos * 100)}% of ${fmt(dayLow)} – ${fmt(dayHigh)}`,
    dir: pos >= 0.7 ? 1 : pos <= 0.3 ? -1 : 0,
    note: pos >= 0.7 ? 'Near the day’s high' : pos <= 0.3 ? 'Near the day’s low' : 'Mid-range',
  });

  const change = prevClose ? last - prevClose : 0;
  return { last, prevClose, change, pct: prevClose ? (change / prevClose) * 100 : 0, dayHigh, dayLow, candles, readings };
}
