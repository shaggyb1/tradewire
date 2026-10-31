import { XMLParser } from 'fast-xml-parser';
import type { Source } from './sources';
import { analyze, type Impact } from './impact';
import { fetchFeedText } from './transport';

export interface NewsItem {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  link: string;
  time: number;
  /**
   * exact = from feed; date = day only (from URL); seen = feed has no date, time is when we first saw it;
   * unknown = no date and already published when we first read the feed, so its age can't be known
   */
  timeKind: 'exact' | 'date' | 'seen' | 'unknown';
  impact: Impact;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  htmlEntities: true,
  isArray: (name) => name === 'item' || name === 'entry',
});

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Offsets in minutes. Fixed (no DST tracking) — close enough for sorting news.
const TZ: Record<string, number> = {
  GMT: 0, UTC: 0, UT: 0, Z: 0, IST: 330, EST: -300, EDT: -240, CET: 60, CEST: 120, BST: 60, JST: 540,
};

function tzOffset(raw: string | undefined, fallback: string): number {
  const t = raw || fallback;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(t);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return TZ[t.toUpperCase()] ?? TZ[fallback.toUpperCase()] ?? 0;
}

/**
 * Handles the formats seen across official feeds:
 *   "Fri, 09 Oct 2026 11:45:00"       (RBI, no zone)
 *   "09-Oct-2026 11:52:53"             (NSE)
 *   "08 Oct, 2026 +0530"               (SEBI)
 *   "Wed, 07 Oct 2026  09:00:00 EST"   (EIA)
 *   "2026-10-09T06:10:59Z"             (Atom/ISO)
 */
export function parseDate(raw: string, fallbackTz: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  const m =
    /(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*,?[\s-]+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*([+-]\d{2}:?\d{2}|[A-Za-z]{1,4})?/.exec(s);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const utc = Date.UTC(Number(m[3]), mon, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  return utc - tzOffset(m[7], fallbackTz) * 60000;
}

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object' && '#text' in (v as object)) return text((v as Record<string, unknown>)['#text']);
  return '';
}

function linkOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const alt = v.find((l) => typeof l === 'object' && (l['@rel'] ?? 'alternate') === 'alternate');
    return linkOf(alt ?? v[0]);
  }
  if (v && typeof v === 'object') return text((v as Record<string, unknown>)['@href']) || text(v);
  return '';
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Removes tracking parameters and forces https where the site supports it. */
export function cleanLink(link: string): string {
  return link
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/([?&])(utm_[^=&]*|fbclid|gclid|mc_cid|mc_eid)=[^&#]*/gi, '$1')
    .replace(/\?&+/, '?')
    .replace(/&{2,}/g, '&')
    .replace(/[?&]+(#|$)/, '$1');
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function parseFeed(xml: string, src: Source, now = Date.now()): NewsItem[] {
  const doc = parser.parse(xml);
  const raw: Record<string, unknown>[] =
    doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item ?? [];

  const items: NewsItem[] = [];
  for (const it of raw.slice(0, src.max ?? 30)) {
    const title = stripHtml(text(it.title));
    if (!title) continue;
    const link = cleanLink(linkOf(it.link) || text(it.guid));
    const summary = stripHtml(text(it.description ?? it.summary ?? it.content)).slice(0, 280);

    let time = parseDate(text(it.pubDate ?? it['dc:date'] ?? it.updated ?? it.published), src.tz);
    let timeKind: NewsItem['timeKind'] = 'exact';
    if (time == null) {
      // e.g. the Fed feed leaves pubDate empty but puts YYYYMMDD in the URL; PIB has no date at all
      const d = /(20\d{2})(\d{2})(\d{2})/.exec(link);
      if (!d && !src.undated) continue;
      time = d ? Date.UTC(+d[1], +d[2] - 1, +d[3], 12) : now;
      timeKind = d ? 'date' : 'seen';
    }
    if (time > now + 5 * 60000) time = now; // guard against bad future dates

    const body = summary && summary !== title ? `${title} ${summary}` : title;
    items.push({
      id: `${src.id}:${hash(link + title)}`,
      sourceId: src.id,
      title,
      summary: summary === title ? '' : summary,
      link,
      time,
      timeKind,
      impact: analyze(body, src.kind, src.region, src.minor),
    });
  }
  return items;
}

export async function fetchSource(src: Source): Promise<NewsItem[]> {
  return parseFeed(await fetchFeedText(src), src);
}
