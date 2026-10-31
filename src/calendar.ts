import type { NewsItem } from './feed';
import { matchWatch } from './watchlist';

/*
 * Official dates, fetched 11 Oct 2026. Update each year when the sources publish new lists.
 *  - NSE trading holidays (equity segment): nseindia.com/resources/exchange-communication-holidays
 *  - RBI MPC schedule 2026-27: RBI press release, 23 Mar 2026
 *  - FOMC schedule: federalreserve.gov/monetarypolicy/fomccalendars.htm
 *  - CPI / IIP / GDP: MoSPI Advance Release Calendar 2026-27 (updated 25 May 2026)
 *  - F&O expiry: Nifty weekly on Tuesday, NSE monthly on last Tuesday, Sensex weekly on Thursday,
 *    BSE monthly on last Thursday; moved to the previous trading day if that day is a holiday.
 */

export const NSE_HOLIDAYS: Record<string, string> = {
  '2026-01-15': 'Municipal Corporation Election - Maharashtra',
  '2026-01-26': 'Republic Day',
  '2026-02-15': 'Mahashivratri',
  '2026-03-03': 'Holi',
  '2026-03-21': 'Id-Ul-Fitr (Ramadan Eid)',
  '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id',
  '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-08': 'Diwali Laxmi Pujan (Muhurat trading)',
  '2026-11-10': 'Diwali-Balipratipada',
  '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2026-12-25': 'Christmas',
};
/** Holidays after this date are unknown until NSE publishes the next list. */
export const HOLIDAYS_KNOWN_UNTIL = '2026-12-31';

export type EventKind = 'RBI' | 'Fed' | 'Data' | 'Budget' | 'Expiry' | 'Holiday' | 'Results';

export interface CalEvent {
  date: string; // YYYY-MM-DD (IST)
  title: string;
  kind: EventKind;
  /** 3 = big market mover, 2 = notable, 1 = routine */
  weight: 1 | 2 | 3;
  note?: string;
  link?: string;
}

const FIXED_EVENTS: CalEvent[] = [
  // RBI policy decisions (last day of each MPC meeting)
  ...['2026-04-08', '2026-06-05', '2026-08-05', '2026-10-07', '2026-12-04', '2027-02-05'].map(
    (date): CalEvent => ({ date, title: 'RBI policy decision', kind: 'RBI', weight: 3, note: 'Repo rate & stance, usually 10:00 AM IST' }),
  ),
  // FOMC decisions (2nd day, 2 PM Washington time)
  ...(
    [
      ['2026-10-28', '~11:30 PM IST'],
      ['2026-12-09', '~12:30 AM IST (night of 9th→10th)'],
      ['2027-01-27', '~12:30 AM IST (night of 27th→28th)'],
      ['2027-03-17', '~11:30 PM IST'],
      ['2027-04-28', '~11:30 PM IST'],
      ['2027-06-09', '~11:30 PM IST'],
      ['2027-07-28', '~11:30 PM IST'],
      ['2027-09-15', '~11:30 PM IST'],
      ['2027-10-27', '~11:30 PM IST'],
      ['2027-12-08', '~12:30 AM IST (night of 8th→9th)'],
    ] as const
  ).map(([date, time]): CalEvent => ({ date, title: 'US Fed (FOMC) rate decision', kind: 'Fed', weight: 3, note: `${time} · tentative until confirmed` })),
  // India CPI inflation (MoSPI, 4 PM IST; next working day if a holiday)
  ...['2026-10-12', '2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12', '2027-03-12'].map(
    (date): CalEvent => ({ date, title: 'India CPI inflation', kind: 'Data', weight: 3, note: '4:00 PM IST · next working day if a holiday' }),
  ),
  // India IIP
  ...['2026-10-28', '2026-11-28', '2026-12-28', '2027-01-28', '2027-02-28', '2027-03-28'].map(
    (date): CalEvent => ({ date, title: 'India industrial output (IIP)', kind: 'Data', weight: 2, note: 'Next working day if a holiday' }),
  ),
  // India GDP
  { date: '2026-11-30', title: 'India GDP — Q2 FY27', kind: 'Data', weight: 3, note: 'MoSPI quarterly estimate' },
  { date: '2027-01-07', title: 'India GDP — First Advance Estimate FY27', kind: 'Data', weight: 3 },
  { date: '2027-02-26', title: 'India GDP — Q3 FY27 & Second Advance Estimate', kind: 'Data', weight: 3 },
  // Union Budget
  { date: '2027-02-01', title: 'Union Budget 2027-28', kind: 'Budget', weight: 3, note: 'Customary date; confirm when announced' },
];

// ---------- date helpers (all in IST) ----------

const IST_MS = 330 * 60000;
const DAY_MS = 24 * 3600 * 1000;

export function istDate(t: number): string {
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}

export function isTradingDay(date: string): boolean {
  const wd = weekday(date);
  return wd !== 0 && wd !== 6 && !NSE_HOLIDAYS[date];
}

function prevTradingDay(date: string): string {
  let d = date;
  for (let i = 0; i < 10 && !isTradingDay(d); i++) d = addDays(d, -1);
  return d;
}

function isLastWeekdayOfMonth(date: string): boolean {
  return addDays(date, 7).slice(5, 7) !== date.slice(5, 7);
}

function expiries(from: string, days: number): CalEvent[] {
  const out: CalEvent[] = [];
  for (let i = 0; i < days + 7; i++) {
    const d = addDays(from, i);
    const wd = weekday(d);
    if (wd !== 2 && wd !== 4) continue;
    const monthly = isLastWeekdayOfMonth(d);
    const actual = prevTradingDay(d);
    const moved = actual !== d ? ` · moved from ${d.slice(8)}/${d.slice(5, 7)} (holiday)` : '';
    if (wd === 2) {
      out.push(
        monthly
          ? { date: actual, title: 'NSE monthly F&O expiry', kind: 'Expiry', weight: 2, note: `Nifty, Bank Nifty & stock F&O${moved}` }
          : { date: actual, title: 'Nifty weekly expiry', kind: 'Expiry', weight: 1, note: moved.slice(3) || undefined },
      );
    } else {
      out.push(
        monthly
          ? { date: actual, title: 'BSE monthly expiry', kind: 'Expiry', weight: 1, note: `Sensex & Bankex${moved}` }
          : { date: actual, title: 'Sensex weekly expiry', kind: 'Expiry', weight: 1, note: moved.slice(3) || undefined },
      );
    }
  }
  return out;
}

// ---------- results dates from NSE "board meeting" notices ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');

/** Finds "on 29-Oct-2026", "on 29/10/2026", "on October 29, 2026" etc. after a board-meeting mention. */
export function meetingDate(text: string): string | null {
  const after = text.slice(Math.max(0, text.search(/board meeting|meeting date/i)));
  let m = /\b(\d{1,2})(?:st|nd|rd|th)?[-\s/.]+([A-Za-z]{3,9}|\d{1,2})[-\s/.,]+(20\d{2})\b/.exec(after);
  if (m) {
    const mon = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon && Number(m[1]) <= 31) return `${m[3]}-${pad(mon)}-${pad(Number(m[1]))}`;
  }
  m = /\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/.exec(after);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${pad(Number(m[2]))}`;
  return null;
}

function resultsEvents(items: NewsItem[], watchlist: string[], from: string): CalEvent[] {
  if (!watchlist.length) return [];
  const seen = new Set<string>();
  const out: CalEvent[] = [];
  for (const i of items) {
    const text = `${i.title} ${i.summary}`;
    const who = matchWatch(text, watchlist);
    if (!who) continue;
    // NSE corporate actions: "Concord Biotech Limited - Ex-Date: 04-Nov-2026"
    const ex = /^(.*?)\s*-\s*Ex-Date:\s*(\d{1,2}-[A-Za-z]{3}-20\d{2})/i.exec(i.title);
    if (ex) {
      const date = meetingDate(`board meeting ${ex[2]}`);
      const purpose = /PURPOSE:\s*([^|]+)/i.exec(i.summary)?.[1]?.trim();
      if (date && date >= from && !seen.has(`ex${who}${date}`)) {
        seen.add(`ex${who}${date}`);
        out.push({ date, title: `${ex[1]} — ex-date`, kind: 'Results', weight: 2, note: `${purpose ? `${purpose} · ` : ''}Watchlist: ${who}`, link: i.link });
      }
      continue;
    }
    if (!/(board meeting|meeting date)/i.test(text) || !/result/i.test(text)) continue;
    const date = meetingDate(text);
    if (!date || date < from || seen.has(who + date)) continue;
    seen.add(who + date);
    out.push({ date, title: `${i.title} — results (board meeting)`, kind: 'Results', weight: 2, note: `Watchlist: ${who}`, link: i.link });
  }
  return out;
}

// ---------- public ----------

export function upcomingEvents(now: number, items: NewsItem[], watchlist: string[], days = 60): CalEvent[] {
  const from = istDate(now);
  const to = addDays(from, days);
  const holidays = Object.entries(NSE_HOLIDAYS)
    .filter(([d]) => weekday(d) !== 0 && weekday(d) !== 6)
    .map(([date, name]): CalEvent => ({ date, title: `Market holiday — ${name}`, kind: 'Holiday', weight: 2, note: 'NSE & BSE closed' }));
  const order: Record<EventKind, number> = { Holiday: 0, RBI: 1, Fed: 2, Budget: 3, Data: 4, Results: 5, Expiry: 6 };
  return [...FIXED_EVENTS, ...holidays, ...expiries(from, days), ...resultsEvents(items, watchlist, from)]
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
}

export function dayLabel(date: string, now: number): string {
  const today = istDate(now);
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const d = new Date(date + 'T00:00:00Z');
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${wd}, ${d.getUTCDate()} ${mon}`;
}
