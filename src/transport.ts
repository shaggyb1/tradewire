import type { Source } from './sources';

// Native: the phone talks directly to each site. See transport.web.ts for the browser version.

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const TIMEOUT_MS = 15000;
const NSE = 'https://www.nseindia.com';
/** NSE's session cookie lasts a few minutes; refresh it a bit before that */
const SESSION_MS = 4 * 60 * 1000;

let sessionAt = 0;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFeedText(src: Source): Promise<string> {
  const res = await timedFetch(src.url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'Cache-Control': 'no-cache',
    },
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const nseGet = (path: string) =>
  timedFetch(NSE + path, {
    credentials: 'include',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.8', Referer: `${NSE}/option-chain` },
  });

/** Loads an NSE page once so the site sets the cookies its data requests require. */
async function ensureSession(force = false): Promise<void> {
  if (!force && Date.now() - sessionAt < SESSION_MS) return;
  await nseGet('/option-chain');
  sessionAt = Date.now();
}

export async function nseFetch(path: string): Promise<Response> {
  await ensureSession();
  let res = await nseGet(path);
  if (res.status === 401 || res.status === 403) {
    await ensureSession(true);
    res = await nseGet(path);
  }
  return res;
}
