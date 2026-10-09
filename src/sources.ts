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
  /** Max items kept from this feed per refresh */
  max?: number;
}

// Every URL below was checked to return a live RSS feed.
export const SOURCES: Source[] = [
  // India — official
  { id: 'rbi-pr', name: 'RBI Press Releases', short: 'RBI', url: 'https://www.rbi.org.in/pressreleases_rss.xml', region: 'India', kind: 'Central Bank', official: true, tz: '+0530' },
  { id: 'rbi-notif', name: 'RBI Notifications', short: 'RBI', url: 'https://www.rbi.org.in/notifications_rss.xml', region: 'India', kind: 'Central Bank', official: true, tz: '+0530' },
  { id: 'sebi', name: 'SEBI', short: 'SEBI', url: 'https://www.sebi.gov.in/sebirss.xml', region: 'India', kind: 'Regulator', official: true, tz: '+0530' },
  { id: 'pib', name: 'PIB (Govt of India)', short: 'PIB', url: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3', region: 'India', kind: 'Government', official: true, tz: '+0530' },
  { id: 'nse-ann', name: 'NSE Corporate Announcements', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530', max: 60 },
  { id: 'nse-circ', name: 'NSE Circulars', short: 'NSE', url: 'https://nsearchives.nseindia.com/content/RSS/Circulars.xml', region: 'India', kind: 'Exchange', official: true, tz: '+0530' },
  { id: 'bse', name: 'BSE Notices', short: 'BSE', url: 'https://www.bseindia.com/data/xml/notices.xml', region: 'India', kind: 'Exchange', official: true, tz: 'GMT' },

  // Global — official
  { id: 'fed', name: 'US Federal Reserve', short: 'FED', url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'Global', kind: 'Central Bank', official: true, tz: 'EST' },
  { id: 'ecb', name: 'European Central Bank', short: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', region: 'Global', kind: 'Central Bank', official: true, tz: 'CET' },
  { id: 'boe', name: 'Bank of England', short: 'BoE', url: 'https://www.bankofengland.co.uk/rss/news', region: 'Global', kind: 'Central Bank', official: true, tz: 'GMT', max: 25 },
  { id: 'boj', name: 'Bank of Japan', short: 'BoJ', url: 'https://www.boj.or.jp/en/rss/whatsnew.xml', region: 'Global', kind: 'Central Bank', official: true, tz: 'JST', max: 25 },
  { id: 'sec', name: 'US SEC', short: 'SEC', url: 'https://www.sec.gov/news/pressreleases.rss', region: 'Global', kind: 'Regulator', official: true, tz: 'EST' },
  { id: 'eia', name: 'US Energy Info. Admin', short: 'EIA', url: 'https://www.eia.gov/rss/todayinenergy.xml', region: 'Global', kind: 'Energy', official: true, tz: 'EST' },

  // Media — off by default, faster but not official
  { id: 'bl', name: 'BusinessLine Markets', short: 'BL', url: 'https://www.thehindubusinessline.com/markets/feeder/default.rss', region: 'India', kind: 'Media', official: false, tz: '+0530', max: 30 },
  { id: 'mint', name: 'Mint Markets', short: 'MINT', url: 'https://www.livemint.com/rss/markets', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'et', name: 'ET Markets', short: 'ET', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', region: 'India', kind: 'Media', official: false, tz: '+0530' },
  { id: 'bbc-biz', name: 'BBC Business', short: 'BBC', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
  { id: 'bbc-world', name: 'BBC World', short: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'Global', kind: 'Media', official: false, tz: 'GMT' },
];

export const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export const DEFAULT_ENABLED: string[] = SOURCES.filter((s) => s.official).map((s) => s.id);
