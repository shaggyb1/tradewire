import type { NewsItem } from './feed';

const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/** Merges a fresh fetch into the existing list; returns ids not seen before. */
export function merge(prev: NewsItem[], fresh: NewsItem[], now: number) {
  const byId = new Map(prev.map((i) => [i.id, i]));
  const added: string[] = [];
  for (const f of fresh) {
    const old = byId.get(f.id);
    if (old) {
      // Keep the original "first seen" time for feeds without dates
      byId.set(f.id, f.timeKind === 'seen' ? { ...f, time: old.time } : f);
    } else {
      byId.set(f.id, f);
      added.push(f.id);
    }
  }
  const items = [...byId.values()]
    .filter((i) => now - i.time < MAX_AGE_MS)
    .sort((a, b) => b.time - a.time)
    .slice(0, 600);
  return { items, added };
}
