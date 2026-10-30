// Security tests for the website's server routes. No network: fetch is replaced.
// Run: npx tsx --test tests/security.test.mts
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GET as feed } from '../src/app/api/feed+api';
import { GET as feeds } from '../src/app/api/feeds+api';
import { GET as nse } from '../src/app/api/nse+api';

let calls: string[] = [];
beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response('{}', { status: 200, headers: { 'set-cookie': 'a=1; Path=/' } });
  }) as typeof fetch;
});

const nseReq = (path: string) => new Request(`https://x/api/nse?path=${encodeURIComponent(path)}`);
const feedReq = (id: string) => new Request(`https://x/api/feed?id=${encodeURIComponent(id)}`);

test('feed route refuses anything but a known source id', async () => {
  for (const id of ['', 'evil', 'https://evil.com', '../etc/passwd', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const r = await feed(feedReq(id));
    assert.equal(r.status, 404, `id=${id}`);
  }
  assert.deepEqual(calls, []);
});

test('feed route fetches only the listed address', async () => {
  const r = await feed(feedReq('rbi-pr'));
  assert.equal(r.status, 200);
  assert.deepEqual(calls, ['https://www.rbi.org.in/pressreleases_rss.xml']);
  assert.match(r.headers.get('content-type')!, /text\/plain/);
});

test('batch route refuses unknown, empty and oversized lists without fetching', async () => {
  const req = (ids: string) => new Request(`https://x/api/feeds?ids=${encodeURIComponent(ids)}`);
  for (const ids of ['', 'evil', 'rbi-pr,evil', '__proto__', 'https://evil.com', 'rbi-pr,sebi,pib,nse-ann,nse-circ,bse,fed,ecb,boe']) {
    assert.equal((await feeds(req(ids))).status, 400, ids);
  }
  assert.deepEqual(calls, []);
});

test('batch route returns each feed, and reports one failure without losing the rest', async () => {
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('sebi')) throw new Error('secret internal detail');
    return new Response('<rss/>');
  }) as typeof fetch;
  const r = await feeds(new Request('https://x/api/feeds?ids=rbi-pr,sebi'));
  const j = await r.json();
  assert.equal(j['rbi-pr'].text, '<rss/>');
  assert.equal(j.sebi.error, 'unreachable');
  assert.equal(calls.length, 2);
});

test('NSE route refuses everything outside its allowlist without contacting NSE', async () => {
  const bad = [
    '',
    '/',
    '/etc/passwd',
    'https://evil.com/',
    '//evil.com/api/allIndices',
    '@evil.com/api/allIndices',
    '/api/allIndices/../../admin',
    '/api/allIndices?x=1',
    '/api/allIndices\n',
    '/api/allIndices#x',
    '/api/option-chain-contract-info?symbol=NIFTY&x=1',
    '/api/option-chain-contract-info?symbol=../..',
    '/api/option-chain-contract-info?symbol=NIFTY\r\nX-Evil: 1',
    '/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=../../x',
    '/api/NextApi/apiClient/indexTrackerApi?functionName=evil&&index=NIFTY&flag=1D',
    '/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexChart&&index=../x&flag=1D',
  ];
  for (const p of bad) {
    const r = await nse(nseReq(p));
    assert.equal(r.status, 403, JSON.stringify(p));
  }
  assert.deepEqual(calls, []);
});

test('NSE route: every address the app uses is allowed and only reaches nseindia.com', async () => {
  const good = [
    '/api/allIndices',
    '/api/option-chain-contract-info?symbol=NIFTY',
    '/api/option-chain-v3?type=Indices&symbol=BANKNIFTY&expiry=27-Oct-2026',
    `/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexChart&&index=${encodeURIComponent('NIFTY 50')}&flag=1D`,
    `/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexChart&&index=${encodeURIComponent('NIFTY FINANCIAL SERVICES')}&flag=1D`,
  ];
  for (const p of good) assert.equal((await nse(nseReq(p))).status, 200, p);
  for (const u of calls) assert.ok(u.startsWith('https://www.nseindia.com/'), u);
});

test('a failing upstream gives a clean error, never internal details', async () => {
  globalThis.fetch = (async () => {
    throw new Error('secret internal detail');
  }) as typeof fetch;
  for (const r of [await feed(feedReq('rbi-pr')), await nse(nseReq('/api/allIndices'))]) {
    assert.equal(r.status, 502);
    assert.ok(!(await r.text()).includes('secret'));
  }
});
