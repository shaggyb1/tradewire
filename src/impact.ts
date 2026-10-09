import type { Kind, Region } from './sources';
import { analyzeTone, type Tone } from './tone';

/** 0 = untagged, 1 = low, 2 = medium, 3 = high */
export type Level = 0 | 1 | 2 | 3;

export interface Impact {
  level: Level;
  tags: string[];
  sectors: string[];
  tone: Tone;
}

interface Rule {
  tag: string;
  level: Level;
  re: RegExp;
  sectors?: string[];
  onlyKinds?: Kind[];
}

// Keyword rules for how a headline typically moves Indian markets.
// These are heuristics for triage, not predictions.
const RULES: Rule[] = [
  { tag: 'Rates', level: 3, re: /\b(repo rate|policy rate|monetary policy|MPC|rate (cut|hike|decision)|interest rates?|FOMC|federal funds|bank rate|deposit facility|main refinancing)\b/i, sectors: ['Banks', 'NBFCs', 'Realty', 'Autos'] },
  { tag: 'Inflation', level: 3, re: /\b(CPI|WPI|inflation|consumer price|producer price|PCE)\b/i, sectors: ['FMCG', 'Banks'] },
  { tag: 'Fiscal', level: 3, re: /\b(union budget|budget|fiscal deficit|GST|customs duty|excise duty|tariffs?|disinvestment|windfall tax)\b/i },
  { tag: 'Geopolitics', level: 3, re: /\b(war|military|missiles?|airstrikes?|sanctions?|ceasefire|invasion|terror\w*)\b/i, sectors: ['Defence', 'Oil', 'Gold'] },
  { tag: 'Credit stress', level: 3, re: /\b(default(ed|s)?|insolvency|bankrupt\w*|NCLT|downgraded?|moratorium)\b/i, sectors: ['Banks', 'NBFCs'] },
  { tag: 'Growth data', level: 2, re: /\b(GDP|IIP|industrial production|PMI|payrolls|employment situation|unemployment|retail sales|core sector|trade deficit|current account)\b/i },
  { tag: 'Liquidity', level: 2, re: /\b(VRR|VRRR|reverse repo|liquidity|LAF|OMO|open market operations?|CRR|SLR|cash reserve ratio)\b/i, sectors: ['Banks', 'PSU Banks'] },
  { tag: 'Bonds', level: 2, re: /\b(G-?Secs?|government securit\w+|treasury bills?|T-?bills?|bonds?|yields?|SDLs?|state development loans?)\b/i, sectors: ['Banks', 'Insurance'] },
  { tag: 'Currency', level: 2, re: /\b(rupee|INR|forex|foreign exchange|exchange rate|US dollar|FX reserves?)\b/i, sectors: ['IT', 'Pharma', 'Oil importers'] },
  { tag: 'Crude & energy', level: 2, re: /\b(crude|oil prices?|OPEC\+?|brent|WTI|natural gas|LNG|petrol|diesel|gasoline)\b/i, sectors: ['OMCs', 'Aviation', 'Paints', 'Upstream oil'] },
  { tag: 'Metals', level: 1, re: /\b(gold|silver|copper|steel|alumini?um|iron ore)\b/i, sectors: ['Metals', 'Jewellery'] },
  { tag: 'Market rules', level: 2, re: /\b(F&O|derivatives?|margins?|lot sizes?|position limits?|expiry|circuit|trading holiday|surveillance|ASM|GSM)\b/i, sectors: ['Brokers', 'Exchanges'] },
  { tag: 'Regulation', level: 1, re: /\b(circular|framework|regulations?|amendments?|guidelines|master direction|consultation paper)\b/i },
  { tag: 'Enforcement', level: 2, re: /\b(penalty|penalt\w+|order in the matter|enforcement action|debar\w*|ban(ned)?|suspend\w*|suspension|settlement order|show cause|fraud)\b/i },
  { tag: 'Results', level: 2, re: /\b(financial results|quarterly results|earnings|outcome of board meeting|board meeting)\b/i },
  { tag: 'Corp action', level: 2, re: /\b(dividend|bonus|stock split|sub-?division|buy-?back|rights issue|record date|merger|amalgamation|acquisition|demerger|delisting|open offer|QIP|preferential issue)\b/i },
  { tag: 'Order win', level: 1, re: /\b(order (win|received|inflow)|bagging|bags|letter of award|LoA|awarded)\b/i, onlyKinds: ['Exchange', 'Media'] },
  { tag: 'Mgmt change', level: 1, re: /\b(resignation|appointment of (CEO|MD|CFO)|cessation)\b/i, onlyKinds: ['Exchange'] },
];

export function analyze(text: string, kind: Kind, region: Region): Impact {
  let level: Level = 0;
  const tags: string[] = [];
  const sectors = new Set<string>();
  for (const r of RULES) {
    if (r.onlyKinds && !r.onlyKinds.includes(kind)) continue;
    if (!r.re.test(text)) continue;
    tags.push(r.tag);
    if (r.level > level) level = r.level;
    r.sectors?.forEach((s) => sectors.add(s));
  }
  return { level, tags: tags.slice(0, 4), sectors: [...sectors].slice(0, 5), tone: analyzeTone(text, region === 'India') };
}
