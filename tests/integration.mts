// Integration test against a running site. Hits the network.
// Run: npx tsx tests/integration.mts <base url> [rounds]
import { parseFeed } from '../src/feed';
import { requiredNsePaths } from './nsePaths';
import { SOURCES } from '../src/sources';

const base = process.argv[2] ?? 'http://localhost:8090';
const rounds = Number(process.argv[3] ?? 5);
const stats = new Map<string, { ok: number; fail: string[]; ms: number[]; note: string }>();
const rec = (name: string, ok: boolean, ms: number, why = '', note = '') => {
  const s = stats.get(name) ?? { ok: 0, fail: [], ms: [], note: '' };
  if (ok) s.ok++;
  else s.fail.push(why);
  s.ms.push(ms);
  if (note) s.note = note;
  stats.set(name, s);
};

async function timed(url: string) {
  const t = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  return { res, text, ms: Date.now() - t };
}

for (let round = 1; round <= rounds; round++) {
  await Promise.all(
    SOURCES.map(async (s) => {
      const t = Date.now();
      try {
        const { res, text, ms } = await timed(`${base}/api/feed?id=${s.id}`);
        const items = res.ok ? parseFeed(text, s) : [];
        const newest = items.length ? Math.max(...items.map((i) => i.time)) : 0;
        const days = newest ? ((Date.now() - newest) / 86400000).toFixed(1) : '?';
        rec(`feed ${s.id}`, res.ok && items.length > 0, ms, `HTTP ${res.status} items=${items.length}`, `${items.length} items, newest ${days}d old, ${(text.length / 1024).toFixed(0)}KB`);
      } catch (e) {
        rec(`feed ${s.id}`, false, Date.now() - t, String(e));
      }
    }),
  );
  for (const p of await requiredNsePaths(base)) {
    const t = Date.now();
    try {
      const { res, text, ms } = await timed(`${base}/api/nse?path=${encodeURIComponent(p.path)}`);
      const check = res.ok ? p.check(JSON.parse(text)) : `HTTP ${res.status}`;
      rec(`nse ${p.name}`, check === true, ms, String(check), `${(text.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      rec(`nse ${p.name}`, false, Date.now() - t, String(e));
    }
  }
}

// The website's batched route
for (let i = 0; i < SOURCES.length; i += 8) {
  const ids = SOURCES.slice(i, i + 8);
  const t = Date.now();
  try {
    const { res, text, ms } = await timed(`${base}/api/feeds?ids=${ids.map((s) => s.id).join(',')}`);
    const j = res.ok ? JSON.parse(text) : {};
    const good = ids.filter((s) => j[s.id]?.text && parseFeed(j[s.id].text, s).length > 0).length;
    rec(`batch ${i / 8 + 1}`, good === ids.length, ms, `HTTP ${res.status}, ${good}/${ids.length}`, `${(text.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    rec(`batch ${i / 8 + 1}`, false, Date.now() - t, String(e));
  }
}

let bad = 0;
for (const [name, s] of stats) {
  const sorted = [...s.ms].sort((a, b) => a - b);
  const status = s.fail.length ? 'FAIL' : 'ok  ';
  if (s.fail.length) bad++;
  console.log(`${status} ${name.padEnd(26)} ${s.ok}/${s.ok + s.fail.length}  median ${String(sorted[sorted.length >> 1]).padStart(5)}ms max ${String(sorted[sorted.length - 1]).padStart(5)}ms  ${s.note}${s.fail.length ? '  ' + [...new Set(s.fail)].join(' | ') : ''}`);
}
console.log(`\n${stats.size - bad}/${stats.size} endpoints fully passed over ${rounds} rounds on ${base}`);
