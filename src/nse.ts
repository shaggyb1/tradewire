import { nseFetch } from './transport';

/*
 * Reads market data from the public nseindia.com website — the same requests its own pages make.
 * NSE has no official free API for this, so it is unofficial: data may be delayed, and NSE can change or
 * block these addresses at any time. Requests are made only while the News, Options or Insights screen is open.
 */

async function api<T>(path: string): Promise<T> {
  const res = await nseFetch(path);
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
