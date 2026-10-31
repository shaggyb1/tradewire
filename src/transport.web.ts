import type { Source } from './sources';

// Browsers can't read these sites directly (CORS), so requests go through this site's own server routes.

const TIMEOUT_MS = 20000;
/** Must not exceed MAX_BATCH in app/api/feeds+api.ts */
const BATCH_SIZE = 8;

async function timedFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    throw new Error("Can't reach the TradeWire server. Check your connection and try again");
  } finally {
    clearTimeout(timer);
  }
}

function friendly(res: Response): Error {
  return new Error(res.status === 429 ? 'Too many requests right now. Try again in a minute' : `HTTP ${res.status}`);
}

async function fetchOne(id: string): Promise<string> {
  const res = await timedFetch(`/api/feed?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw friendly(res);
  return res.text();
}

interface Waiter {
  id: string;
  resolve: (text: string) => void;
  reject: (e: Error) => void;
}

let queue: Waiter[] = [];

async function sendBatch(batch: Waiter[]) {
  try {
    const res = await timedFetch(`/api/feeds?ids=${batch.map((w) => encodeURIComponent(w.id)).join(',')}`);
    if (res.status === 429) throw friendly(res);
    if (!res.ok) throw new Error('batch failed');
    const data = (await res.json()) as Record<string, { text?: string; error?: string }>;
    for (const w of batch) {
      const r = data[w.id];
      if (r?.text != null) w.resolve(r.text);
      // Most failures are brief, so try this one feed again straight away
      else fetchOne(w.id).then(w.resolve, w.reject);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Too many')) {
      batch.forEach((w) => w.reject(e as Error));
      return;
    }
    // The batch itself failed (e.g. too much data at once): fetch these one by one
    for (const w of batch) fetchOne(w.id).then(w.resolve, w.reject);
  }
}

/** Feeds requested together are sent together, in batches, to use far fewer requests. */
export function fetchFeedText(src: Source): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!queue.length) {
      setTimeout(() => {
        const all = queue;
        queue = [];
        for (let i = 0; i < all.length; i += BATCH_SIZE) sendBatch(all.slice(i, i + BATCH_SIZE));
      }, 0);
    }
    queue.push({ id: src.id, resolve, reject });
  });
}

export async function nseFetch(path: string): Promise<Response> {
  const res = await timedFetch(`/api/nse?path=${encodeURIComponent(path)}`);
  if (res.status === 429) throw friendly(res);
  return res;
}
