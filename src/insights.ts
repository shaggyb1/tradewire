import { isTradingDay, istDate, NSE_HOLIDAYS, upcomingEvents, type CalEvent } from './calendar';
import type { NewsItem } from './feed';
import type { IndexQuote } from './nse';
import { matchWatch } from './watchlist';

const DAY_MS = 24 * 3600 * 1000;

// ---------- 4. Event risk meter ----------

export interface DayRisk {
  date: string;
  level: 'High' | 'Medium' | 'Low' | 'Closed';
  reasons: string[];
}

/** How eventful a trading day is, from the calendar. Higher = more likely to be volatile. */
export function dayRisk(date: string, events: CalEvent[]): DayRisk {
  if (!isTradingDay(date)) {
    return { date, level: 'Closed', reasons: [NSE_HOLIDAYS[date] ? `Market holiday — ${NSE_HOLIDAYS[date]}` : 'Weekend'] };
  }
  const prev = new Date(Date.parse(date + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);
  const today = events.filter((e) => e.date === date && e.kind !== 'Holiday');
  // A Fed decision late last night (IST) lands on today's open
  const overnight = events.filter((e) => e.date === prev && e.kind === 'Fed').map((e) => ({ ...e, title: 'US Fed decision overnight' }));
  const all = [...overnight, ...today];
  const top = Math.max(0, ...all.map((e) => e.weight));
  return {
    date,
    level: top >= 3 ? 'High' : top === 2 ? 'Medium' : 'Low',
    reasons: all.length ? all.map((e) => e.title) : ['No scheduled market events'],
  };
}

export function riskOutlook(now: number, items: NewsItem[], watchlist: string[], days = 3): DayRisk[] {
  const events = upcomingEvents(now - DAY_MS, items, watchlist, days + 1);
  const out: DayRisk[] = [];
  for (let i = 0; i < days; i++) out.push(dayRisk(istDate(now + i * DAY_MS), events));
  return out;
}

// ---------- 3. 7-day mood trend ----------

export interface DayMood {
  date: string;
  up: number;
  down: number;
}

export function moodTrend(items: NewsItem[], now: number, days = 7): DayMood[] {
  const out: DayMood[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: istDate(now - i * DAY_MS), up: 0, down: 0 });
  const byDate = new Map(out.map((d) => [d.date, d]));
  for (const i of items) {
    if (i.timeKind === 'date') continue;
    const d = byDate.get(istDate(i.time));
    if (!d) continue;
    if (i.impact.tone.dir > 0) d.up++;
    else if (i.impact.tone.dir < 0) d.down++;
  }
  return out;
}

/** Compares the last 3 days' net mood with the 4 days before. */
export function trendWord(days: DayMood[]): { word: string; dir: -1 | 0 | 1 } {
  if (days.reduce((a, d) => a + d.up + d.down, 0) < 3) return { word: 'Too little news', dir: 0 };
  const net = (ds: DayMood[]) => {
    const up = ds.reduce((a, d) => a + d.up, 0);
    const down = ds.reduce((a, d) => a + d.down, 0);
    return up + down ? (up - down) / (up + down) : 0;
  };
  const recent = net(days.slice(-3));
  const before = net(days.slice(0, -3));
  const diff = recent - before;
  if (diff > 0.15) return { word: 'Improving', dir: 1 };
  if (diff < -0.15) return { word: 'Worsening', dir: -1 };
  return { word: 'Steady', dir: 0 };
}

// ---------- 1. Sector heatmap ----------

/** Our sector names → NSE sector index, where one exists. */
export const SECTOR_INDEX: Record<string, string> = {
  'Broad market': 'NIFTY 50',
  Banks: 'NIFTY BANK',
  'PSU Banks': 'NIFTY PSU BANK',
  NBFCs: 'NIFTY FINANCIAL SERVICES EX-BANK',
  Realty: 'NIFTY REALTY',
  Autos: 'NIFTY AUTO',
  IT: 'NIFTY IT',
  Pharma: 'NIFTY PHARMA',
  FMCG: 'NIFTY FMCG',
  OMCs: 'NIFTY OIL & GAS',
  'Upstream oil': 'NIFTY OIL & GAS',
  Metals: 'NIFTY METAL',
};

export interface SectorHeat {
  sector: string;
  up: number;
  down: number;
  /** Today's % change of the matching NSE sector index, if known */
  indexPct?: number;
}

export function sectorHeat(items: NewsItem[], now: number, quotes: IndexQuote[], hours = 24): SectorHeat[] {
  const map = new Map<string, SectorHeat>();
  for (const i of items) {
    if (now - i.time > hours * 3600 * 1000) continue;
    for (const [sector, n] of Object.entries(i.impact.tone.sectors ?? {})) {
      const h = map.get(sector) ?? { sector, up: 0, down: 0 };
      if (n > 0) h.up++;
      else if (n < 0) h.down++;
      map.set(sector, h);
    }
  }
  const byIndex = new Map(quotes.map((q) => [q.index, q.percentChange]));
  for (const h of map.values()) {
    const idx = SECTOR_INDEX[h.sector];
    if (idx && byIndex.has(idx)) h.indexPct = byIndex.get(idx);
  }
  return [...map.values()].sort((a, b) => b.up + b.down - (a.up + a.down));
}

// ---------- 2. Watchlist news trend ----------

export interface WatchTrend {
  term: string;
  up: number;
  down: number;
  total: number;
  trend: { word: string; dir: -1 | 0 | 1 };
  latest?: NewsItem;
}

export function watchTrends(items: NewsItem[], watchlist: string[], now: number): WatchTrend[] {
  return watchlist.map((term) => {
    const mine = items.filter((i) => now - i.time < 7 * DAY_MS && matchWatch(`${i.title} ${i.summary}`, [term]));
    return {
      term,
      up: mine.filter((i) => i.impact.tone.dir > 0).length,
      down: mine.filter((i) => i.impact.tone.dir < 0).length,
      total: mine.length,
      trend: trendWord(moodTrend(mine, now)),
      latest: mine[0],
    };
  });
}
