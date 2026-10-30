const BASE = 'https://www.nseindia.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const SESSION_MS = 4 * 60 * 1000;

/** Web only. Just the NSE data addresses the app uses; anything else is refused. */
const ALLOWED = [
  /^\/api\/option-chain-contract-info\?symbol=[A-Z]+$/,
  /^\/api\/option-chain-v3\?type=Indices&symbol=[A-Z]+&expiry=[0-9A-Za-z-]+$/,
  /^\/api\/allIndices$/,
  /^\/api\/NextApi\/apiClient\/indexTrackerApi\?functionName=getIndexChart&&index=[A-Z0-9%]+&flag=1D$/,
];

let cookie = '';
let sessionAt = 0;

const nseGet = (path: string) =>
  fetch(BASE + path, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9, */*;q=0.8', Referer: `${BASE}/option-chain`, Cookie: cookie },
  });

async function ensureSession(force = false) {
  if (!force && cookie && Date.now() - sessionAt < SESSION_MS) return;
  const res = await nseGet('/option-chain');
  cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  sessionAt = Date.now();
}

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!ALLOWED.some((re) => re.test(path))) return new Response('Not allowed', { status: 403 });
  try {
    await ensureSession();
    let res = await nseGet(path);
    if (res.status === 401 || res.status === 403) {
      await ensureSession(true);
      res = await nseGet(path);
    }
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    });
  } catch {
    return new Response('NSE unreachable', { status: 502 });
  }
}
