/*
 * Reads market data from the public nseindia.com website — the same requests its own pages make.
 * NSE has no official free API for this, so it is unofficial: data may be delayed, and NSE can change or
 * block these addresses at any time. Requests are made only while the Options or Insights screen is open.
 */

const BASE = 'https://www.nseindia.com';
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const TIMEOUT_MS = 15000;
/** NSE's session cookie lasts a few minutes; refresh it a bit before that */
const SESSION_MS = 4 * 60 * 1000;

let sessionAt = 0;

async function get(path: string, referer: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(BASE + path, {
      signal: ctrl.signal,
      credentials: 'include',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.8', Referer: BASE + referer },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Loads an NSE page once so the site sets the cookies its data requests require. */
async function ensureSession(force = false): Promise<void> {
  if (!force && Date.now() - sessionAt < SESSION_MS) return;
  await get('/option-chain', '/');
  sessionAt = Date.now();
}

async function api<T>(path: string): Promise<T> {
  await ensureSession();
  let res = await get(path, '/option-chain');
  if (res.status === 401 || res.status === 403) {
    await ensureSession(true);
    res = await get(path, '/option-chain');
  }
  if (!res.ok) throw new Error(res.status === 404 ? 'NSE changed its data address' : `NSE returned ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('NSE blocked the request — try again in a minute');
  }
}

// ---------- types ----------

export interface OptionLeg {
  strikePrice: number;
  openInterest: number;
  changeinOpenInterest: number;
  impliedVolatility: number;
  lastPrice: number;
  change: number;
  totalTradedVolume: number;
}

export interface ChainRow {
  strikePrice: number;
  CE?: OptionLeg;
  PE?: OptionLeg;
}

export interface Chain {
  timestamp: string;
  spot: number;
  rows: ChainRow[];
}

export interface IndexQuote {
  index: string;
  last: number;
  percentChange: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
}

export interface Tick {
  /** Real epoch ms */
  t: number;
  price: number;
  /** false during the 9:00–9:15 pre-open session */
  normal: boolean;
}

// ---------- endpoints ----------

export const OPTION_SYMBOLS = [
  { symbol: 'NIFTY', index: 'NIFTY 50', label: 'Nifty' },
  { symbol: 'BANKNIFTY', index: 'NIFTY BANK', label: 'Bank Nifty' },
  { symbol: 'FINNIFTY', index: 'NIFTY FINANCIAL SERVICES', label: 'Fin Nifty' },
  { symbol: 'MIDCPNIFTY', index: 'NIFTY MIDCAP SELECT', label: 'Midcap Nifty' },
] as const;
export type OptionSymbol = (typeof OPTION_SYMBOLS)[number]['symbol'];

export async function getExpiries(symbol: OptionSymbol): Promise<string[]> {
  const r = await api<{ expiryDates?: string[] }>(`/api/option-chain-contract-info?symbol=${symbol}`);
  return r.expiryDates ?? [];
}

export async function getChain(symbol: OptionSymbol, expiry: string): Promise<Chain> {
  const r = await api<{ records?: { timestamp: string; underlyingValue: number; data: ChainRow[] } }>(
    `/api/option-chain-v3?type=Indices&symbol=${symbol}&expiry=${encodeURIComponent(expiry)}`,
  );
  if (!r.records?.data) throw new Error('No option chain data');
  return { timestamp: r.records.timestamp, spot: r.records.underlyingValue, rows: r.records.data };
}

export async function getAllIndices(): Promise<IndexQuote[]> {
  const r = await api<{ data?: IndexQuote[] }>('/api/allIndices');
  return r.data ?? [];
}

/** Today's minute-by-minute index prices (last session's when the market is closed). */
export async function getIndexTicks(index: string): Promise<{ prevClose: number; ticks: Tick[] }> {
  const r = await api<{ data?: { closePrice: number; grapthData: [number, number, string][] } }>(
    `/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexChart&&index=${encodeURIComponent(index)}&flag=1D`,
  );
  const raw = r.data?.grapthData ?? [];
  // NSE writes IST wall-clock time as if it were UTC; shift to real epoch
  const ticks = raw.map(([t, price, flag]) => ({ t: t - 330 * 60000, price, normal: flag !== 'PO' }));
  return { prevClose: r.data?.closePrice ?? 0, ticks };
}
