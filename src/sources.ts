export type Region = 'India' | 'Global';
export type Kind = 'Regulator' | 'Exchange' | 'Government' | 'Central Bank' | 'Energy' | 'Media';

export interface Source {
  id: string;
  name: string;
  short: string;
  url: string;
  region: Region;
  kind: Kind;
  /** true = published by the institution itself; false = news media */
  official: boolean;
  /** Time zone to assume when the feed's dates have none */
  tz: string;
  /** Feed publishes no dates at all; otherwise undated items are treated as stale and dropped */
  undated?: boolean;
  /** Shown in the feed, but too far from Indian markets to count towards impact or bullish/bearish signals */
  minor?: boolean;
  /** Max items kept from this feed per refresh */
  max?: number;
}

// Every URL below was checked to return a live RSS feed.
export const SOURCES: Source[] = [
  // India — official
  { id: 'rbi-pr', name: 'RBI Press Releases', short: 'RBI', url: 'https://www.rbi.org.in/pressreleases_rss.xml', region: 'India', kind: 'Central Bank', official: true, tz: '+0530' },
  { id: 'rbi-notif', name: 'RBI Notifications', short: 'RBI', url: 'https://www.rbi.org.in/notifications_rss.xml', region: 'India', kind: 'Central Bank', official: true, tz: '+0530' },
  { id: 'sebi', name: 'SEBI', short: 'SEBI', url: 'https://www.sebi.gov.in/sebirss.xml', region: 'India', kind: 'Regulator', official: true, tz: '+0530' },
  { id: 'pib', name: 'PIB (Govt of India)', short: 'PIB', url: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3', region: 'India', kind: 'Government', official: true, tz: '+0530', undated: true },
  { id: 'nse-ann', name: 'NSE Corporate Announcements', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530', max: 60 },
  { id: 'nse-circ', name: 'NSE Circulars', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Circulars.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530' },
  { id: 'bse', name: 'BSE Notices', short: 'BSE', url: 'https://www.bseindia.com/data/xml/notices.xml', region: 'India', kind: 'Exchange', official: true, tz: 'GMT' },

  { id: 'rbi-speech', name: 'RBI Speeches', short: 'RBI', url: 'https://www.rbi.org.in/speeches_rss.xml', region: 'India', kind: 'Central Bank', official: true, tz: '+0530' },
  { id: 'nse-board', name: 'NSE Board Meetings', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Board_Meetings.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530', max: 40 },
  { id: 'nse-ca', name: 'NSE Corporate Actions', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Corporate_action.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530', max: 40 },
  { id: 'nse-offer', name: 'NSE Offer Documents (IPOs)', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Offer_Documents.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530' },

  // Global — official
  { id: 'fed', name: 'US Federal Reserve', short: 'FED', url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'Global', kind: 'Central Bank', official: true, tz: 'EST' },
  { id: 'ecb', name: 'European Central Bank', short: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', region: 'Global', kind: 'Central Bank', official: true, tz: 'CET' },
  { id: 'boe', name: 'Bank of England', short: 'BoE', url: 'https://www.bankofengland.co.uk/rss/news', region: 'Global', kind: 'Central Bank', official: true, tz: 'GMT', max: 25 },
  { id: 'boj', name: 'Bank of Japan', short: 'BoJ', url: 'https://www.boj.or.jp/en/rss/whatsnew.xml', region: 'Global', kind: 'Central Bank', official: true, tz: 'JST', max: 25 },
  { id: 'sec', name: 'US SEC', short: 'SEC', url: 'https://www.sec.gov/news/pressreleases.rss', region: 'Global', kind: 'Regulator', official: true, tz: 'EST' },
  { id: 'eia', name: 'US Energy Info. Admin', short: 'EIA', url: 'https://www.eia.gov/rss/todayinenergy.xml', region: 'Global', kind: 'Energy', official: true, tz: 'EST' },

  { id: 'fed-speech', name: 'US Fed Speeches', short: 'FED', url: 'https://www.federalreserve.gov/feeds/speeches.xml', region: 'Global', kind: 'Central Bank', official: true, tz: 'EST' },
  { id: 'bea', name: 'US Bureau of Economic Analysis', short: 'BEA', url: 'https://apps.bea.gov/rss/rss.xml', region: 'Global', kind: 'Government', official: true, tz: 'EST', max: 20 },
  { id: 'census', name: 'US Census Indicators', short: 'CENSUS', url: 'https://www.census.gov/economic-indicators/indicator.xml', region: 'Global', kind: 'Government', official: true, tz: 'EST' },
  { id: 'bis', name: 'BIS Central Bank Speeches', short: 'BIS', url: 'https://www.bis.org/doclist/cbspeeches.rss', region: 'Global', kind: 'Central Bank', official: true, tz: 'GMT', max: 25, minor: true },
  { id: 'boc', name: 'Bank of Canada', short: 'BoC', url: 'https://www.bankofcanada.ca/content_type/press-releases/feed/', region: 'Global', kind: 'Central Bank', official: true, tz: 'EST', minor: true },
  { id: 'rbnz', name: 'Reserve Bank of New Zealand', short: 'RBNZ', url: 'https://www.rbnz.govt.nz/feeds/news', region: 'Global', kind: 'Central Bank', official: true, tz: 'GMT', max: 20, minor: true },
  { id: 'snb', name: 'Swiss National Bank', short: 'SNB', url: 'https://www.snb.ch/public/en/rss/pressrel', region: 'Global', kind: 'Central Bank', official: true, tz: 'CET', minor: true },
  { id: 'cftc', name: 'US CFTC', short: 'CFTC', url: 'https://www.cftc.gov/RSS/RSSGP/rssgp.xml', region: 'Global', kind: 'Regulator', official: true, tz: 'EST', minor: true },
  { id: 'wto', name: 'World Trade Organization', short: 'WTO', url: 'https://www.wto.org/library/rss/latest_news_e.xml', region: 'Global', kind: 'Government', official: true, tz: 'GMT', minor: true },

  // Media — off by default, faster but not official
  { id: 'bl', name: 'BusinessLine Markets', short: 'BL', url: 'https://www.thehindubusinessline.com/markets/feeder/default.rss', region: 'India', kind: 'Media', official: false, tz: '+0530', max: 30 },
  { id: 'mint', name: 'Mint Markets', short: 'MINT', url: 'https://www.livemint.com/rss/markets', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'et', name: 'ET Markets', short: 'ET', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'bs-mkt', name: 'Business Standard Markets', short: 'BS', url: 'https://www.business-standard.com/rss/markets-106.rss', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'bs-eco', name: 'Business Standard Economy', short: 'BS', url: 'https://www.business-standard.com/rss/economy-102.rss', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'bl-eco', name: 'BusinessLine Economy', short: 'BL', url: 'https://www.thehindubusinessline.com/economy/feeder/default.rss', region: 'India', kind: 'Media', official: false, tz: '+0530', max: 30 },
  { id: 'et-eco', name: 'ET Economy', short: 'ET', url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'mint-eco', name: 'Mint Economy', short: 'MINT', url: 'https://www.livemint.com/rss/economy', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'ndtv', name: 'NDTV Profit', short: 'NDTV', url: 'https://feeds.feedburner.com/ndtvprofit-latest', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'cnbc', name: 'CNBC Markets', short: 'CNBC', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', region: 'Global', kind: 'Media', official: false, tz: 'EST' },
  { id: 'mw', name: 'MarketWatch', short: 'MW', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', region: 'Global', kind: 'Media', official: false, tz: 'EST' },
  { id: 'oil', name: 'Oilprice.com', short: 'OIL', url: 'https://oilprice.com/rss/main', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
  { id: 'guardian', name: 'Guardian Business', short: 'GUARD', url: 'https://www.theguardian.com/uk/business/rss', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
  { id: 'nyt', name: 'NYT Business', short: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', region: 'Global', kind: 'Media', official: false, tz: 'EST' },
  { id: 'bbc-biz', name: 'BBC Business', short: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
  { id: 'bbc-world', name: 'BBC World', short: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
];

export const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export const DEFAULT_ENABLED: string[] = SOURCES.filter((s) => s.official).map((s) => s.id);

/** Every source that existed before the app started tracking which sources a user has seen. */
const ORIGINAL_SOURCES = ['rbi-pr', 'rbi-notif', 'sebi', 'pib', 'nse-ann', 'nse-circ', 'bse', 'fed', 'ecb', 'boe', 'boj', 'sec', 'eia', 'bl', 'mint', 'et', 'bbc-biz', 'bbc-world'];

/**
 * Turns on official sources added since the user last opened the app. Anything they already
 * knew about stays as they set it, so a source they switched off is never switched back on.
 */
export function withNewSources(enabled: string[], known: string[] | undefined): string[] {
  const seen = new Set(known ?? ORIGINAL_SOURCES);
  const added = SOURCES.filter((s) => s.official && !seen.has(s.id) && !enabled.includes(s.id)).map((s) => s.id);
  return [...enabled, ...added];
}
