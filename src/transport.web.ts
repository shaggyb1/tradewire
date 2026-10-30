import type { Source } from './sources';

// Browsers can't read these sites directly (CORS), so requests go through this site's own server routes.

const TIMEOUT_MS = 20000;

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

export async function fetchFeedText(src: Source): Promise<string> {
  const res = await timedFetch(`/api/feed?id=${encodeURIComponent(src.id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export function nseFetch(path: string): Promise<Response> {
  return timedFetch(`/api/nse?path=${encodeURIComponent(path)}`);
}
