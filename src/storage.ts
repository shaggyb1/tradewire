import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewsItem } from './feed';
import { analyze } from './impact';
import { DEFAULT_ENABLED, SOURCE_BY_ID } from './sources';

// Everything is stored only on this phone. Nothing is ever uploaded.
const ITEMS_KEY = 'tw.items.v1';
const SETTINGS_KEY = 'tw.settings.v1';

export interface Settings {
  enabled: string[];
  intervalSec: number;
  keepAwake: boolean;
  /** Background alerts: 0 = off, 2 = medium and high, 3 = high only */
  alertLevel: 0 | 2 | 3;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: DEFAULT_ENABLED,
  intervalSec: 60,
  keepAwake: false,
  alertLevel: 0,
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    s.enabled = s.enabled.filter((id) => SOURCE_BY_ID[id]);
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
        return { ...i, impact: analyze(i.summary ? `${i.title} ${i.summary}` : i.title, src.kind, src.region) };
      });
  } catch {
    return [];
  }
}

export async function saveItems(items: NewsItem[]): Promise<void> {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, 400)));
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([ITEMS_KEY, SETTINGS_KEY, 'tw.notified.v1']);
}
