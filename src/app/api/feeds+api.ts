import { SOURCE_BY_ID } from '../../sources';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
/** The hosting plan allows 10 outgoing requests per incoming request */
export const MAX_BATCH = 8;

async function read(url: string): Promise<{ text?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
    });
    return res.ok ? { text: await res.text() } : { error: `HTTP ${res.status}` };
  } catch {
    return { error: 'unreachable' };
  }
}

/** Web only. Several feeds in one request, to stay within the hosting plan's request-rate limit. Takes source ids, never URLs. */
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean))];
  if (!ids.length || ids.length > MAX_BATCH || !ids.every((id) => Object.hasOwn(SOURCE_BY_ID, id))) {
    return new Response('Bad source list', { status: 400 });
  }
  const results = await Promise.all(ids.map((id) => read(SOURCE_BY_ID[id].url)));
  return Response.json(Object.fromEntries(ids.map((id, i) => [id, results[i]])), {
    // Never cache a reply containing a failure, or a brief glitch would linger
    headers: { 'Cache-Control': results.some((r) => r.error) ? 'no-store' : 'public, max-age=30' },
  });
}
