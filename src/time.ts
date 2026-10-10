import { istDate, NSE_HOLIDAYS } from './calendar';
import type { NewsItem } from './feed';

const IST_OFFSET_MS = 330 * 60000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Shifted Date whose UTC getters read as IST wall-clock time. */
function ist(t: number): Date {
  return new Date(t + IST_OFFSET_MS);
}

export function istClock(t: number, seconds = false): string {
  const d = ist(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? ':' + pad(d.getUTCSeconds()) : ''}`;
}

export function istDay(t: number): string {
  const d = ist(t);
  return `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]}`;
}

export function ago(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function itemTime(item: NewsItem, now: number): string {
  if (item.timeKind === 'date') return istDay(item.time);
  if (item.timeKind === 'seen') return `seen ${istClock(item.time)} IST`;
  const sameDay = istDay(item.time) === istDay(now);
  return `${ago(item.time, now)} · ${sameDay ? '' : istDay(item.time) + ' '}${istClock(item.time)} IST`;
}

export type MarketState = 'Open' | 'Pre-open' | 'Closed' | 'Weekend' | 'Holiday';

/** NSE cash-market session, including published exchange holidays. */
export function nseState(now: number): MarketState {
  const d = ist(now);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return 'Weekend';
  if (NSE_HOLIDAYS[istDate(now)]) return 'Holiday';
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (mins >= 540 && mins < 555) return 'Pre-open';
  if (mins >= 555 && mins < 930) return 'Open';
  return 'Closed';
}
