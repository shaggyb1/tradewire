import type { Chain, ChainRow } from './nse';

export interface ChainStats {
  spot: number;
  atm: number;
  step: number;
  /** Total put OI ÷ total call OI */
  pcr: number;
  /** Strike where option buyers in total lose the most at expiry */
  maxPain: number;
  /** Highest call OI strike (often read as resistance) */
  callWall: number;
  /** Highest put OI strike (often read as support) */
  putWall: number;
  /** Strikes with the biggest fresh OI added today */
  callBuild: { strike: number; change: number } | null;
  putBuild: { strike: number; change: number } | null;
  atmIv: number;
  /** ATM call + put premium: the market's implied move by expiry */
  straddle: number;
  totalCallOI: number;
  totalPutOI: number;
}

/** Null when the chain has no strikes, e.g. right after an expiry. */
export function chainStats(chain: Chain): ChainStats | null {
  const rows = chain.rows.filter((r) => r.CE || r.PE).sort((a, b) => a.strikePrice - b.strikePrice);
  if (!rows.length) return null;
  const strikes = rows.map((r) => r.strikePrice);
  const step = strikes.length > 1 ? Math.min(...strikes.slice(1).map((s, i) => s - strikes[i]).filter((d) => d > 0)) : 50;
  const atmRow = rows.reduce((best, r) => (Math.abs(r.strikePrice - chain.spot) < Math.abs(best.strikePrice - chain.spot) ? r : best), rows[0]);

  let totalCallOI = 0;
  let totalPutOI = 0;
  let callWall = rows[0];
  let putWall = rows[0];
  let callBuild: ChainRow | null = null;
  let putBuild: ChainRow | null = null;
  for (const r of rows) {
    totalCallOI += r.CE?.openInterest ?? 0;
    totalPutOI += r.PE?.openInterest ?? 0;
    if ((r.CE?.openInterest ?? 0) > (callWall.CE?.openInterest ?? 0)) callWall = r;
    if ((r.PE?.openInterest ?? 0) > (putWall.PE?.openInterest ?? 0)) putWall = r;
    if ((r.CE?.changeinOpenInterest ?? 0) > (callBuild?.CE?.changeinOpenInterest ?? 0)) callBuild = r;
    if ((r.PE?.changeinOpenInterest ?? 0) > (putBuild?.PE?.changeinOpenInterest ?? 0)) putBuild = r;
  }

  // Max pain: expiry price at which total intrinsic value paid to option holders is smallest
  let maxPain = atmRow.strikePrice;
  let least = Infinity;
  for (const s of strikes) {
    let pain = 0;
    for (const r of rows) {
      if (s > r.strikePrice) pain += (s - r.strikePrice) * (r.CE?.openInterest ?? 0);
      if (s < r.strikePrice) pain += (r.strikePrice - s) * (r.PE?.openInterest ?? 0);
    }
    if (pain < least) {
      least = pain;
      maxPain = s;
    }
  }

  const ivs = [atmRow.CE?.impliedVolatility, atmRow.PE?.impliedVolatility].filter((v): v is number => !!v && v > 0);
  return {
    spot: chain.spot,
    atm: atmRow.strikePrice,
    step,
    pcr: totalCallOI ? totalPutOI / totalCallOI : 0,
    maxPain,
    callWall: callWall.strikePrice,
    putWall: putWall.strikePrice,
    callBuild: callBuild?.CE ? { strike: callBuild.strikePrice, change: callBuild.CE.changeinOpenInterest } : null,
    putBuild: putBuild?.PE ? { strike: putBuild.strikePrice, change: putBuild.PE.changeinOpenInterest } : null,
    atmIv: ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : 0,
    straddle: (atmRow.CE?.lastPrice ?? 0) + (atmRow.PE?.lastPrice ?? 0),
    totalCallOI,
    totalPutOI,
  };
}

/** Rows within `n` strikes either side of ATM, for the table. */
export function nearAtm(chain: Chain, atm: number, n = 8): ChainRow[] {
  const rows = chain.rows.filter((r) => r.CE || r.PE).sort((a, b) => a.strikePrice - b.strikePrice);
  const i = rows.findIndex((r) => r.strikePrice === atm);
  return rows.slice(Math.max(0, i - n), i + n + 1);
}

/** Plain-language reading of PCR. Describes positioning only. */
export function pcrReading(pcr: number): string {
  if (pcr >= 1.3) return 'Heavy put writing — traders positioned for support below';
  if (pcr >= 1.0) return 'More puts than calls — mildly supportive positioning';
  if (pcr >= 0.7) return 'More calls than puts — mildly capped positioning';
  return 'Heavy call writing — traders positioned for resistance above';
}
