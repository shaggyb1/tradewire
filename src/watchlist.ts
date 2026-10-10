const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map<string, RegExp>();

function pattern(term: string): RegExp {
  let re = cache.get(term);
  if (!re) {
    // Whole-word match, so "ITC" doesn't match "switch"
    re = new RegExp(`(^|[^A-Za-z0-9])${escape(term)}($|[^A-Za-z0-9])`, 'i');
    cache.set(term, re);
  }
  return re;
}

/** Returns the first watchlist term found in the text, or null. */
export function matchWatch(text: string, watchlist: string[]): string | null {
  for (const term of watchlist) if (pattern(term).test(text)) return term;
  return null;
}

/** Cleans user input: trims, collapses spaces, max 40 chars. */
export function normalizeTerm(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 40);
}
