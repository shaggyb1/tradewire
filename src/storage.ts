import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem } from './feed';
import { analyze } from './impact';
import { MAX_ITEMS } from './merge';
import { DEFAULT_ENABLED, SOURCE_BY_ID, SOURCES, withNewSources } from './sources';

// Everything is stored only on this phone. Nothing is ever uploaded.
const ITEMS_KEY = 'tw.items.v1';
const SETTINGS_KEY = 'tw.settings.v1';

export interface Settings {
  enabled: string[];
  intervalSec: number;
  keepAwake: boolean;
  /** Background alerts: 0 = off, 2 = medium and high, 3 = high only */
  alertLevel: 0 | 2 | 3;
  /** Stocks / topics to highlight, e.g. "Reliance", "crude" */
  watchlist: string[];
  /** When alerts are on: alert only for watchlist news (any impact) */
  watchOnlyAlerts: boolean;
  /** Require fingerprint / face / phone PIN to open the app */
  lockEnabled: boolean;
  /** Block screenshots and blank the app in the recent-apps view */
  hideScreen: boolean;
  /** Sources this user has already been offered, so new ones can be turned on once */
  knownSources?: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: DEFAULT_ENABLED,
  intervalSec: 60,
  keepAwake: false,
  alertLevel: 0,
  watchlist: [],
  watchOnlyAlerts: false,
  lockEnabled: false,
  hideScreen: true,
  knownSources: SOURCES.map((s) => s.id),
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    const saved = JSON.parse(raw) as Partial<Settings>;
    s.enabled = withNewSources(s.enabled.filter((id) => SOURCE_BY_ID[id]), saved.knownSources);
    s.knownSources = SOURCES.map((x) => x.id);
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function loadItems(): Promise<NewsItem[]> {
  try {
    const raw = await AsyncStorage.getItem(ITEMS_KEY);
    const items = raw ? (JSON.parse(raw) as NewsItem[]) : [];
    // Re-score with the current rules so cached items pick up rule changes
    return items
      .filter((i) => SOURCE_BY_ID[i.sourceId] && i.timeKind)
      .map((i) => {
        const src = SOURCE_BY_ID[i.sourceId];
        return { ...i, impact: analyze(i.summary ? `${i.title} ${i.summary}` : i.title, src.kind, src.region, src.minor) };
      });
  } catch {
    return [];
  }
}

export async function saveItems(items: NewsItem[]): Promise<void> {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([ITEMS_KEY, SETTINGS_KEY, 'tw.notified.v1']);
}
