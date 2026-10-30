import type { Chain, ChainRow } from '../src/nse';
import { OPTION_SYMBOLS } from '../src/nse';
import { chainStats } from '../src/optionStats';

export const getChainFromJson = (j: { records: { timestamp: string; underlyingValue: number; data: ChainRow[] } }): Chain => ({
  timestamp: j.records.timestamp,
  spot: j.records.underlyingValue,
  rows: j.records.data,
});

interface NsePath {
  name: string;
  path: string;
  check: (json: never) => true | string;
}

/** The app's NSE requests, for each index, with a check that the data has the shape the app needs. */
export async function requiredNsePaths(base: string): Promise<NsePath[]> {
  const out: NsePath[] = [
    {
      name: 'allIndices',
      path: '/api/allIndices',
      check: (j: { data?: { index: string; last: number }[] }) =>
        ['NIFTY 50', 'NIFTY BANK', 'INDIA VIX', 'NIFTY IT', 'NIFTY OIL & GAS', 'NIFTY FINANCIAL SERVICES EX-BANK'].every((i) => j.data?.some((q) => q.index === i && q.last > 0)) || 'missing index',
    },
  ];
  for (const { symbol, index } of OPTION_SYMBOLS) {
    const res = await fetch(`${base}/api/nse?path=${encodeURIComponent(`/api/option-chain-contract-info?symbol=${symbol}`)}`);
    const expiry = res.ok ? ((await res.json()) as { expiryDates?: string[] }).expiryDates?.[0] : undefined;
    out.push({
      name: `expiries ${symbol}`,
      path: `/api/option-chain-contract-info?symbol=${symbol}`,
      check: (j: { expiryDates?: string[] }) => (j.expiryDates?.length ?? 0) > 0 || 'no expiries',
    });
    out.push({
      name: `chain ${symbol}`,
      path: `/api/option-chain-v3?type=Indices&symbol=${symbol}&expiry=${expiry}`,
      check: (j: never) => {
        const s = chainStats(getChainFromJson(j));
        return (s !== null && s.spot > 0 && s.totalCallOI > 0 && s.pcr > 0) || 'bad chain';
      },
    });
    out.push({
      name: `ticks ${symbol}`,
      path: `/api/NextApi/apiClient/indexTrackerApi?functionName=getIndexChart&&index=${encodeURIComponent(index)}&flag=1D`,
      check: (j: { data?: { grapthData?: unknown[] } }) => (j.data?.grapthData?.length ?? 0) > 0 || 'no ticks',
    });
  }
  return out;
}
