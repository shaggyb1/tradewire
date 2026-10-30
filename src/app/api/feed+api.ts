import { SOURCE_BY_ID } from '../../sources';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/** Web only. Takes a source id, never a URL, so this can't be used to fetch arbitrary sites. */
export async function GET(request: Request) {
  const src = SOURCE_BY_ID[new URL(request.url).searchParams.get('id') ?? ''];
  if (!src) return new Response('Unknown source', { status: 404 });
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
    });
    if (!res.ok) return new Response(`Source returned ${res.status}`, { status: 502 });
    return new Response(await res.text(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=30' },
    });
  } catch {
    return new Response('Source unreachable', { status: 502 });
  }
}
