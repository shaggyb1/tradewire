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

/** `index` is the name NSE's chart service uses, which can differ from its index list. */
export const OPTION_SYMBOLS = [
  { symbol: 'NIFTY', index: 'NIFTY 50', label: 'Nifty' },
  { symbol: 'BANKNIFTY', index: 'NIFTY BANK', label: 'Bank Nifty' },
  { symbol: 'FINNIFTY', index: 'NIFTY FIN SERVICE', label: 'Fin Nifty' },
  { symbol: 'MIDCPNIFTY', index: 'NIFTY MID SELECT', label: 'Midcap Nifty' },
  { symbol: 'NIFTYNXT50', index: 'NIFTY NEXT 50', label: 'Next 50' },
] as const;

export interface FnoStock {
  symbol: string;
  name: string;
}

/** Every stock with options on NSE. */
export async function getFnoStocks(): Promise<FnoStock[]> {
  const r = await api<{ data?: { UnderlyingList?: { symbol: string; underlying: string }[] } }>('/api/underlying-information');
  return (r.data?.UnderlyingList ?? []).map((u) => ({ symbol: u.symbol, name: u.underlying }));
}

export async function getExpiries(symbol: string): Promise<string[]> {
  const r = await api<{ expiryDates?: string[] }>(`/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`);
  return r.expiryDates ?? [];
}

export async function getChain(symbol: string, expiry: string, type: 'Indices' | 'Equity' = 'Indices'): Promise<Chain> {
  const r = await api<{ records?: { timestamp: string; underlyingValue: number; data: ChainRow[] } }>(
    `/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
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

/** Turns NSE's stock chart rows into ticks. It gives each price's change, which reveals the previous close. */
export function parseStockTicks(raw: [number, number, string, string | number, string | number][]): { prevClose: number; ticks: Tick[] } {
  const first = raw[0];
  const prevClose = first ? first[1] - Number(first[3]) : 0;
  return {
    prevClose: Number.isFinite(prevClose) ? prevClose : 0,
    ticks: raw.map(([t, price, flag]) => ({ t: t - 330 * 60000, price, normal: flag !== 'PO' })),
  };
}

/** Today's minute-by-minute prices for a stock. */
export async function getStockTicks(symbol: string): Promise<{ prevClose: number; ticks: Tick[] }> {
  const r = await api<{ grapthData?: [number, number, string, string, string][] }>(
    `/api/NextApi/apiClient/GetQuoteApi?functionName=getSymbolChartData&symbol=${encodeURIComponent(symbol + 'EQN')}&days=1D`,
  );
  return parseStockTicks(r.grapthData ?? []);
}
