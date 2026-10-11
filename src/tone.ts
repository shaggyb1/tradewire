/** -1 = bearish, 0 = neutral or mixed, 1 = bullish */
export type Direction = -1 | 0 | 1;

export interface Tone {
  dir: Direction;
  /** true when both bullish and bearish cues were found */
  mixed: boolean;
  /** 1 = one cue, 2 = several cues pointing the same way */
  strength: 0 | 1 | 2;
  /** Short reasons, e.g. "Rate cut → +Banks, Realty" */
  reasons: string[];
  /** Net push per sector from this item, e.g. { Banks: 1, 'Upstream oil': -1 } */
  sectors: Record<string, number>;
}

interface ToneRule {
  dir: 1 | -1;
  re: RegExp;
  why: string;
  /** Company-level rule: only meaningful for Indian sources */
  local?: boolean;
  /** Sectors this news usually pushes up / down */
  up?: string[];
  down?: string[];
}

// Typical first reaction of Indian equities to each kind of news.
// Keyword heuristics only: they read the headline's wording, not the market.
const UP = '(rises?|rose|risen|jumps?|jumped|surges?|surged|climbs?|climbed|gains?|gained|grows?|grew|expands?|expanded|accelerat\\w*|beats?|higher|record high|up \\d)';
const DOWN = '(falls?|fell|fallen|drops?|dropped|slumps?|slumped|declines?|declined|plunges?|plunged|slides?|slid|eases?|eased|cools?|cooled|slows?|slowed|contracts?|contracted|lower|misses?|record low|down \\d)';

const near = (a: string, b: string, gap = 40) => new RegExp(`\\b${a}\\b.{0,${gap}}\\b${b}`, 'i');

const RULES: ToneRule[] = [
  // Interest rates
  { dir: 1, re: /\b(rate cut|cuts? (the )?(repo|policy|interest|benchmark) rates?|(reduces?|lowers?) (the )?(repo|policy|interest) rates?)\b/i, why: 'Rate cut → +Banks, NBFCs, Realty, Autos', up: ['Banks', 'NBFCs', 'Realty', 'Autos'] },
  { dir: -1, re: /\b(rate hike|hikes? (the )?(repo|policy|interest|benchmark) rates?|(raises?|increases?) (the )?(repo|policy|interest) rates?)\b/i, why: 'Rate hike → −Banks, NBFCs, Realty', down: ['Banks', 'NBFCs', 'Realty', 'Autos'] },
  { dir: 1, re: /\b(CRR cut|cuts? CRR|liquidity (injection|infusion)|inject\w* liquidity)\b/i, why: 'More liquidity → +Banks', up: ['Banks', 'PSU Banks'] },

  // Inflation
  { dir: 1, re: near('(inflation|CPI|WPI)', DOWN), why: 'Inflation easing → room for rate cuts', up: ['Banks', 'FMCG', 'Broad market'] },
  { dir: -1, re: near('(inflation|CPI|WPI)', UP), why: 'Inflation rising → rate-hike risk', down: ['Banks', 'FMCG', 'Broad market'] },

  // Growth
  { dir: 1, re: near('(GDP|growth|PMI|IIP|industrial production|exports?|core sector|GST collections?)', UP), why: 'Stronger economy → broad market +', up: ['Broad market'] },
  { dir: -1, re: near('(GDP|growth|PMI|IIP|industrial production|exports?|core sector)', DOWN), why: 'Weaker economy → broad market −', down: ['Broad market'] },
  { dir: -1, re: /\b(recession|slowdown|stagflation)\b/i, why: 'Slowdown fears → broad market −', down: ['Broad market'] },

  // Crude, rupee, flows
  { dir: 1, re: near('(crude|oil prices?|brent|WTI)', DOWN), why: 'Cheaper crude → +OMCs, Aviation, Paints; −Upstream oil', up: ['OMCs', 'Aviation', 'Paints'], down: ['Upstream oil'] },
  { dir: -1, re: near('(crude|oil prices?|brent|WTI)', UP), why: 'Costlier crude → −OMCs, Aviation, Paints; +Upstream oil', up: ['Upstream oil'], down: ['OMCs', 'Aviation', 'Paints'] },
  { dir: 1, re: /\brupee\b.{0,30}\b(gains?|rises?|strengthens?|appreciates?|firms? up|recovers?)\b/i, why: 'Stronger rupee → +importers, −IT exporters', up: ['OMCs'], down: ['IT', 'Pharma'] },
  { dir: -1, re: /\brupee\b.{0,30}\b(falls?|weakens?|slips?|depreciates?|record low|all-time low)\b/i, why: 'Weaker rupee → −importers, +IT exporters', up: ['IT', 'Pharma'], down: ['OMCs'] },
  { dir: 1, re: near('(FIIs?|FPIs?|foreign (portfolio )?investors?)', '(buy\\w*|inflows?|net buyers?)'), why: 'Foreign buying → market +', up: ['Broad market', 'Banks'] },
  { dir: -1, re: near('(FIIs?|FPIs?|foreign (portfolio )?investors?)', '(sell\\w*|outflows?|net sellers?|pull\\w* out)'), why: 'Foreign selling → market −', down: ['Broad market', 'Banks'] },

  // Fiscal
  { dir: 1, re: /\b(cuts?|reduc\w+|lower\w*|slash\w*)\b.{0,25}\b(GST|taxe?s?|duty|duties|tariffs?)\b/i, why: 'Tax/duty cut → affected sectors +' },
  { dir: -1, re: /\b(hikes?|rais\w+|increas\w+|impos\w+)\b.{0,25}\b(GST|taxe?s?|duty|duties|tariffs?)\b/i, why: 'Tax/duty/tariff hike → affected sectors −' },

  // Ratings
  { dir: 1, re: /\b(upgrades?|upgraded|outlook (to )?(positive|stable from negative))\b/i, why: 'Rating upgrade → +' },
  { dir: -1, re: /\b(downgrades?|downgraded|outlook (to )?negative|credit watch negative)\b/i, why: 'Rating downgrade → −' },

  // Geopolitics
  { dir: -1, re: /\b(war|missiles?|airstrikes?|attacks?|escalat\w+|invasion|sanctions? on|terror\w*)\b/i, why: 'Geopolitical risk → market −, Gold/Defence +', up: ['Defence', 'Gold'], down: ['Broad market'] },
  { dir: 1, re: /\b(ceasefire|peace (deal|talks|agreement)|trade (deal|agreement|pact))\b/i, why: 'Easing tensions / trade deal → market +', up: ['Broad market'] },

  // Company news (Indian sources only)
  { dir: 1, re: /\b(dividend|bonus issue|bonus shares?|buy-?back|stock split)\b/i, why: 'Shareholder payout → stock +', local: true },
  { dir: 1, re: /\b(order (win|received|inflow)|bags? (an? )?order|letter of award|wins? (a |an )?(contract|order))\b/i, why: 'New order → stock +', local: true },
  { dir: 1, re: near('(net profit|profit|revenue|earnings|sales)', UP), why: 'Results improve → stock +', local: true },
  { dir: -1, re: near('(net profit|profit|revenue|earnings|sales)', DOWN), why: 'Results weaken → stock −', local: true },
  { dir: -1, re: /\b(net loss|posts? (a )?loss|widens? loss)\b/i, why: 'Loss reported → stock −', local: true },
  { dir: -1, re: /\b(penalty|penalt\w+|debar\w*|ban(ned)? from|suspend\w*|suspension|show cause|fraud|raids?|probe|investigation|charged)\b/i, why: 'Regulatory action → stock −', local: true },
  { dir: -1, re: /\b(default(ed|s)?|insolvency|bankrupt\w*|NCLT admits|moratorium)\b/i, why: 'Credit stress → −Banks, NBFCs', local: true, down: ['Banks', 'NBFCs'] },

  // Market moves reported by media
  { dir: 1, re: near('(sensex|nifty|markets?|stocks?|shares?|indices)', '(gains?|gained|rall\\w+|jumps?|jumped|surges?|surged|climbs?|climbed|soars?|soared|rises?|rose|skyrockets?)', 30), why: 'Market moving up', up: ['Broad market'] },
  { dir: -1, re: near('(sensex|nifty|markets?|stocks?|shares?|indices)', '(falls?|fell|drops?|dropped|crash\\w*|tumbles?|tumbled|slumps?|slumped|plunges?|plunged|sinks?|sank|tank\\w*)', 30), why: 'Market moving down', down: ['Broad market'] },
];

// A cue doesn't count when negated just before it ("unlikely to cut rates")
// or inside it ("Sensex not likely to rally").
const NEGATION_BEFORE = /\b(no|not|unlikely|without|rules? out|ruled out|denies|halts?)\b[^.]{0,12}$/i;
const NEGATION_INSIDE = /\b(no|not|unlikely|fails? to|failed to)\b/i;

export function analyzeTone(text: string, india: boolean): Tone {
  let up = 0;
  let down = 0;
  const reasons: string[] = [];
  const sectors: Record<string, number> = {};
  for (const r of RULES) {
    if (r.local && !india) continue;
    const m = r.re.exec(text);
    if (!m || NEGATION_INSIDE.test(m[0]) || NEGATION_BEFORE.test(text.slice(Math.max(0, m.index - 25), m.index))) continue;
    if (r.dir > 0) up++;
    else down++;
    if (!reasons.includes(r.why)) reasons.push(r.why);
    r.up?.forEach((x) => (sectors[x] = (sectors[x] ?? 0) + 1));
    r.down?.forEach((x) => (sectors[x] = (sectors[x] ?? 0) - 1));
  }
  const net = up - down;
  const dir: Direction = net > 0 ? 1 : net < 0 ? -1 : 0;
  return {
    dir,
    mixed: up > 0 && down > 0,
    strength: dir === 0 ? 0 : Math.abs(net) >= 2 ? 2 : 1,
    reasons: reasons.slice(0, 2),
    sectors,
  };
}
