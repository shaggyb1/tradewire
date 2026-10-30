// Functional and regression tests. Run: npx tsx --test tests/logic.test.mts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayLabel, isTradingDay, meetingDate, upcomingEvents } from '../src/calendar';
import { cleanLink, parseDate, parseFeed } from '../src/feed';
import { analyze } from '../src/impact';
import { ema, intraday, rsi, supertrend, toCandles } from '../src/indicators';
import { dayRisk, moodTrend, riskOutlook, sectorHeat, trendWord, watchTrends } from '../src/insights';
import { merge } from '../src/merge';
import type { Chain, Tick } from '../src/nse';
import { chainStats, nearAtm, pcrReading } from '../src/optionStats';
import { SOURCE_BY_ID, SOURCES } from '../src/sources';
import { nseState } from '../src/time';
import { analyzeTone } from '../src/tone';
import { matchWatch, normalizeTerm } from '../src/watchlist';

const ist = (s: string) => Date.parse(s + '+05:30');

test('parseDate handles every format official feeds use', () => {
  const t = Date.UTC(2026, 9, 9, 6, 15);
  assert.equal(parseDate('Fri, 09 Oct 2026 11:45:00', '+0530'), t); // RBI, no zone
  assert.equal(parseDate('09-Oct-2026 11:45:00', '+0530'), t); // NSE
  assert.equal(parseDate('Fri, 09 Oct 2026 06:15:00 GMT', 'GMT'), t); // BSE
  assert.equal(parseDate('2026-10-09T06:15:00Z', 'GMT'), t); // ISO
  assert.equal(parseDate('08 Oct, 2026 +0530', 'GMT'), Date.UTC(2026, 9, 7, 18, 30)); // SEBI
  assert.equal(parseDate('Wed, 07 Oct 2026  09:00:00 EST', 'GMT'), Date.UTC(2026, 9, 7, 14)); // EIA
  assert.equal(parseDate('', 'GMT'), null);
  assert.equal(parseDate('not a date', 'GMT'), null);
});

test('cleanLink strips tracking and upgrades to https', () => {
  assert.equal(cleanLink('http://a.in/x?utm_source=y&id=5&fbclid=z'), 'https://a.in/x?id=5');
  assert.equal(cleanLink('https://a.in/x?utm_source=y'), 'https://a.in/x');
  assert.equal(cleanLink('https://a.in/x?id=5'), 'https://a.in/x?id=5');
});

test('parseFeed: parses RSS, Atom and survives bad input', () => {
  const rss = '<rss><channel><item><title>RBI cuts repo rate</title><link>http://a.in/1</link><pubDate>09 Oct 2026 10:00:00 +0530</pubDate></item></channel></rss>';
  const [i] = parseFeed(rss, SOURCE_BY_ID['rbi-pr'], Date.UTC(2026, 9, 10));
  assert.equal(i.title, 'RBI cuts repo rate');
  assert.equal(i.link, 'https://a.in/1');
  assert.equal(i.impact.level, 3);
  assert.equal(i.impact.tone.dir, 1);
  const atom = '<feed><entry><title>T</title><link href="https://a.in/2"/><updated>2026-10-09T00:00:00Z</updated></entry></feed>';
  assert.equal(parseFeed(atom, SOURCE_BY_ID.fed, Date.UTC(2026, 9, 10))[0].link, 'https://a.in/2');
  assert.deepEqual(parseFeed('<html>blocked</html>', SOURCE_BY_ID.fed), []);
  assert.deepEqual(parseFeed('', SOURCE_BY_ID.fed), []);
});

test('parseFeed: scripts in a feed title are reduced to text', () => {
  const rss = '<rss><channel><item><title>&lt;script&gt;alert(1)&lt;/script&gt;Hi</title><link>https://a.in/1</link><pubDate>09 Oct 2026 10:00:00 +0530</pubDate></item></channel></rss>';
  const [i] = parseFeed(rss, SOURCE_BY_ID.fed, Date.UTC(2026, 9, 10));
  assert.ok(!i.title.includes('<script'));
});

test('regression: undated items are dropped, except from feeds that never date', () => {
  const rss = '<rss><channel><item><title>Old</title><link>https://a.in/old</link></item></channel></rss>';
  assert.equal(parseFeed(rss, SOURCE_BY_ID.eia).length, 0);
  const [p] = parseFeed(rss, SOURCE_BY_ID.pib);
  assert.equal(p.timeKind, 'seen');
});

test('regression: first read of a dateless feed sorts below fresh dated news', () => {
  const now = Date.UTC(2026, 9, 10);
  const rss = '<rss><channel><item><title>P</title><link>https://a.in/p</link></item></channel></rss>';
  const pib = parseFeed(rss, SOURCE_BY_ID.pib, now);
  const dated = parseFeed('<rss><channel><item><title>D</title><link>https://a.in/d</link><pubDate>09 Oct 2026 23:00:00 GMT</pubDate></item></channel></rss>', SOURCE_BY_ID.fed, now);
  const { items } = merge([], [...pib, ...dated], now);
  assert.equal(items[0].title, 'D');
  assert.equal(items[1].timeKind, 'unknown');
  const again = merge(items, pib, now + 3600000);
  assert.equal(again.added.length, 0);
  assert.equal(again.items.find((i) => i.title === 'P')!.timeKind, 'unknown');
});

test('merge reports only new items, removes old ones, caps the list', () => {
  const now = Date.UTC(2026, 9, 10);
  const mk = (n: number, age = 0) => parseFeed(`<rss><channel><item><title>T${n}</title><link>https://a.in/${n}</link><pubDate>${new Date(now - age).toUTCString()}</pubDate></item></channel></rss>`, SOURCE_BY_ID.fed, now)[0];
  const first = merge([], [mk(1)], now);
  assert.equal(first.added.length, 1);
  assert.equal(merge(first.items, [mk(1)], now).added.length, 0);
  assert.equal(merge([], [mk(2, 8 * 86400000)], now).items.length, 0);
  const many = Array.from({ length: 700 }, (_, i) => mk(i + 10));
  assert.equal(merge([], many, now).items.length, 600);
});

test('tone: direction, negation and India-only company rules', () => {
  const cases: [string, number][] = [
    ['RBI cuts repo rate by 25 bps', 1],
    ['RBI keeps repo rate unchanged', 0],
    ['RBI unlikely to cut repo rate', 0],
    ['No RBI rate cuts in the near-term', 0],
    ['Sensex not likely to rally', 0],
    ['CPI inflation eases to 2.1%', 1],
    ['Brent crude jumps 4%', -1],
    ['Rupee falls to record low', -1],
    ['Nifty falls 1% as FIIs sell', -1],
    ['Fed raises interest rates', -1],
  ];
  for (const [text, dir] of cases) assert.equal(analyzeTone(text, true).dir, dir, text);
  assert.equal(analyzeTone('SEC charged firm with fraud', false).dir, 0);
  assert.equal(analyzeTone('SEBI penalty on broker for fraud', true).dir, -1);
  assert.deepEqual(analyzeTone('Brent crude jumps 4%', true).sectors, { 'Upstream oil': 1, OMCs: -1, Aviation: -1, Paints: -1 });
});

test('impact: levels', () => {
  assert.equal(analyze('RBI repo rate decision', 'Central Bank', 'India').level, 3);
  assert.equal(analyze('Daily bulletin', 'Exchange', 'India').level, 0);
});

test('watchlist matches whole words, safely', () => {
  assert.equal(matchWatch('ITC Limited results', ['ITC']), 'ITC');
  assert.equal(matchWatch('switch to new plant', ['ITC']), null);
  assert.equal(matchWatch('HDFC Bank Ltd', ['hdfc bank']), 'hdfc bank');
  assert.equal(matchWatch('anything', ['(((']), null); // regex characters must not crash
  assert.equal(matchWatch('M&M results', ['M&M']), 'M&M');
  assert.equal(normalizeTerm('  a   b '), 'a b');
  assert.equal(normalizeTerm('x'.repeat(99)).length, 40);
});

test('market status knows sessions, weekends and holidays', () => {
  assert.equal(nseState(ist('2026-10-20T11:00:00')), 'Holiday');
  assert.equal(nseState(ist('2026-10-19T11:00:00')), 'Open');
  assert.equal(nseState(ist('2026-10-19T09:05:00')), 'Pre-open');
  assert.equal(nseState(ist('2026-10-19T09:14:59')), 'Pre-open');
  assert.equal(nseState(ist('2026-10-19T09:15:00')), 'Open');
  assert.equal(nseState(ist('2026-10-19T15:29:59')), 'Open');
  assert.equal(nseState(ist('2026-10-19T15:30:00')), 'Closed');
  assert.equal(nseState(ist('2026-10-11T11:00:00')), 'Weekend');
  assert.equal(isTradingDay('2026-10-20'), false);
});

test('calendar expiries match NSE’s own published dates', () => {
  // From NSE's contract list: 03-Nov, 09-Nov, 17-Nov, 23-Nov 2026
  const events = upcomingEvents(ist('2026-11-01T09:00:00'), [], [], 30).filter((e) => e.kind === 'Expiry' && /Nifty weekly|NSE monthly/.test(e.title));
  assert.deepEqual(events.slice(0, 4).map((e) => e.date), ['2026-11-03', '2026-11-09', '2026-11-17', '2026-11-23']);
  assert.ok(/monthly/.test(events[3].title), 'last Tuesday (moved for holiday) is the monthly');
});

test('calendar: dates, labels and results detection', () => {
  const now = ist('2026-10-11T09:00:00');
  assert.equal(dayLabel('2026-10-11', now), 'Today');
  assert.equal(dayLabel('2026-10-12', now), 'Tomorrow');
  assert.equal(meetingDate('Board Meeting to be held on 29/10/2026 for results'), '2026-10-29');
  assert.equal(meetingDate('board meeting on October 30, 2026 for results'), '2026-10-30');
  assert.equal(meetingDate('Board meeting on 5th November 2026'), '2026-11-05');
  assert.equal(meetingDate('no date here'), null);
});

test('event risk', () => {
  const now = ist('2026-10-11T09:00:00');
  const [today, tomorrow] = riskOutlook(now, [], [], 2);
  assert.equal(today.level, 'Closed');
  assert.equal(tomorrow.level, 'High');
  assert.equal(dayRisk('2026-10-20', []).level, 'Closed');
  const afterFed = riskOutlook(ist('2026-10-29T09:00:00'), [], [], 1)[0];
  assert.ok(afterFed.reasons.includes('US Fed decision overnight'));
  assert.equal(afterFed.level, 'High');
});

const ticks = (prices: number[], startMin = 555): Tick[] =>
  prices.map((price, i) => ({ t: Date.UTC(2026, 9, 9, 0, startMin + i) - 330 * 60000, price, normal: true }));

test('indicators: known values', () => {
  assert.deepEqual(ema([10, 10, 10], 3), [10, 10, 10]);
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => 100 + i)), 100);
  assert.equal(rsi(Array.from({ length: 20 }, (_, i) => 100 - i)), 0);
  assert.ok(Number.isNaN(rsi([1, 2, 3])));
  assert.equal(supertrend(toCandles(ticks([1, 2]))), null);
});

test('regression: candles use only the 9:15–15:30 session', () => {
  const pre = ticks([1, 2, 3], 540);
  const post = ticks([9, 9], 930);
  const c = toCandles([...pre, ...ticks([100, 101]), ...post]);
  assert.equal(c.length, 1);
  assert.equal(c[0].o, 100);
  assert.equal(c[0].c, 101);
});

test('intraday readings: uptrend reads up; empty data is safe', () => {
  const up = intraday(ticks(Array.from({ length: 300 }, (_, i) => 100 + i)), 90)!;
  assert.equal(up.readings.find((r) => r.label === 'EMA 9 / 21')!.dir, 1);
  assert.equal(up.readings.find((r) => r.label === 'Supertrend 10,3')!.dir, 1);
  assert.equal(up.readings.find((r) => r.label === 'Opening range')!.dir, 1);
  assert.equal(intraday([], 100), null);
  assert.equal(intraday(ticks([100]), 0)!.pct, 0);
});

const leg = (strikePrice: number, openInterest: number, change = 0, lastPrice = 10, iv = 12) => ({ strikePrice, openInterest, changeinOpenInterest: change, impliedVolatility: iv, lastPrice, change: 0, totalTradedVolume: 0 });

test('option chain: PCR, walls, max pain, straddle', () => {
  const chain: Chain = {
    timestamp: 'x',
    spot: 102,
    rows: [
      { strikePrice: 90, CE: leg(90, 10), PE: leg(90, 100, 50) },
      { strikePrice: 100, CE: leg(100, 50, 5, 7), PE: leg(100, 50, 1, 3) },
      { strikePrice: 110, CE: leg(110, 100, 60), PE: leg(110, 10) },
    ],
  };
  const s = chainStats(chain)!;
  assert.equal(s.atm, 100);
  assert.equal(s.step, 10);
  assert.equal(s.pcr, 1);
  assert.equal(s.callWall, 110);
  assert.equal(s.putWall, 90);
  assert.equal(s.maxPain, 100);
  assert.equal(s.straddle, 10);
  assert.equal(s.callBuild!.strike, 110);
  assert.equal(s.putBuild!.strike, 90);
  assert.equal(nearAtm(chain, 100, 1).length, 3);
  assert.equal(typeof pcrReading(0), 'string');
});

test('option chain: thin or empty data doesn’t crash', () => {
  assert.doesNotThrow(() => chainStats({ timestamp: '', spot: 100, rows: [{ strikePrice: 100, CE: leg(100, 0, 0, 0, 0) }] }));
  assert.equal(chainStats({ timestamp: '', spot: 100, rows: [] }), null);
});

test('insights: trend needs enough news; heat counts sectors', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  assert.equal(trendWord(moodTrend([], now)).word, 'Too little news');
  const mk = (title: string, id: number) => parseFeed(`<rss><channel><item><title>${title}</title><link>https://a.in/${id}</link><pubDate>${new Date(now - 3600000).toUTCString()}</pubDate></item></channel></rss>`, SOURCE_BY_ID.bl, now)[0];
  const items = [mk('RBI cuts repo rate', 1), mk('Brent crude jumps 4%', 2)];
  const heat = sectorHeat(items, now, [{ index: 'NIFTY BANK', last: 1, percentChange: 2, previousClose: 1, open: 1, high: 1, low: 1 }]);
  assert.equal(heat.find((h) => h.sector === 'Banks')!.up, 1);
  assert.equal(heat.find((h) => h.sector === 'Banks')!.indexPct, 2);
  assert.equal(heat.find((h) => h.sector === 'OMCs')!.down, 1);
  assert.equal(watchTrends(items, ['RBI'], now)[0].total, 1);
});

test('sources: https only, unique ids, official on by default', () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  for (const s of SOURCES) assert.ok(s.url.startsWith('https://'), s.id);
  assert.ok(SOURCES.some((s) => !s.official));
});
