import type { NewsItem } from './feed';

/** Where to sort undated items from a feed's first read: below today's dated news */
const UNKNOWN_AGE_MS = 12 * 3600 * 1000;

const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MAX_PER_SOURCE = 500;
/** Keeps the saved list well under Android's 2 MB limit for one stored value (1.3 MB at most) */
export const MAX_ITEMS = 1200;

/** Merges a fresh fetch into the existing list; returns ids not seen before. */
export function merge(prev: NewsItem[], fresh: NewsItem[], now: number) {
  const byId = new Map(prev.map((i) => [i.id, i]));
  const added: string[] = [];
  const knownSources = new Set(prev.map((i) => i.sourceId));
  for (const f of fresh) {
    const old = byId.get(f.id);
    if (old) {
      // Keep the original "first seen" time for feeds without dates
      byId.set(f.id, f.timeKind === 'seen' ? { ...f, time: old.time, timeKind: old.timeKind } : f);
    } else if (f.timeKind === 'seen' && !knownSources.has(f.sourceId)) {
      // First read of a dateless feed: these were published earlier, by an unknown amount
      byId.set(f.id, { ...f, time: now - UNKNOWN_AGE_MS, timeKind: 'unknown' });
      added.push(f.id);
    } else {
      byId.set(f.id, f);
      added.push(f.id);
    }
  }
  // Limit each source separately, so a busy feed can't push out another source's older news
  const perSource = new Map<string, number>();
  const items = [...byId.values()]
    .filter((i) => now - i.time < MAX_AGE_MS)
    .sort((a, b) => b.time - a.time)
    .filter((i) => {
      const n = (perSource.get(i.sourceId) ?? 0) + 1;
      perSource.set(i.sourceId, n);
      return n <= MAX_PER_SOURCE;
    })
    .slice(0, MAX_ITEMS);
  return { items, added };
}
