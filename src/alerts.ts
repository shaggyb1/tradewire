import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { fetchSource, type NewsItem } from './feed';
import { merge } from './merge';
import { SOURCE_BY_ID, SOURCES } from './sources';
import { loadItems, loadSettings, saveItems } from './storage';
import { LEVEL_LABEL } from './theme';
import { matchWatch } from './watchlist';

const TASK = 'tradewire-news-check';
const CHANNEL = 'market-alerts';
const NOTIFIED_KEY = 'tw.notified.v1';
/** Don't alert on items older than this, e.g. after the phone was off overnight */
const FRESH_MS = 6 * 3600 * 1000;
const MAX_SINGLE_ALERTS = 3;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function loadNotified(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse((await AsyncStorage.getItem(NOTIFIED_KEY)) ?? '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Fetches enabled sources, saves them, and raises a local notification for
 * new items at or above the chosen impact level. Shared by the background task.
 */
export async function checkAndNotify(): Promise<number> {
  const settings = await loadSettings();
  if (settings.alertLevel === 0) return 0;

  const srcs = SOURCES.filter((s) => settings.enabled.includes(s.id));
  const results = await Promise.allSettled(srcs.map(fetchSource));
  const fresh = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!fresh.length) return 0;

  const now = Date.now();
  const prev = await loadItems();
  const { items, added } = merge(prev, fresh, now);
  await saveItems(items);
  // First run ever: just build the baseline, don't flood with alerts
  if (!prev.length) return 0;

  const notified = await loadNotified();
  const addedSet = new Set(added);
  const watchOf = (i: NewsItem) => matchWatch(`${i.title} ${i.summary}`, settings.watchlist);
  const hits: NewsItem[] = items
    .filter(
      (i) =>
        addedSet.has(i.id) &&
        !notified.has(i.id) &&
        i.timeKind !== 'date' &&
        now - i.time < FRESH_MS &&
        (watchOf(i) !== null || (!settings.watchOnlyAlerts && i.impact.level >= settings.alertLevel)),
    )
    // Watchlist news first
    .sort((a, b) => Number(watchOf(b) !== null) - Number(watchOf(a) !== null));
  if (!hits.length) return 0;

  for (const item of hits.slice(0, MAX_SINGLE_ALERTS)) {
    const src = SOURCE_BY_ID[item.sourceId];
    const watch = watchOf(item);
    // With the app lock on, keep headlines off the lock screen
    const content = settings.lockEnabled
      ? { title: 'TradeWire', body: watch ? 'New update on your watchlist' : 'New market update' }
      : {
          title: `${watch ? `★ ${watch} · ` : ''}${src.short} · ${LEVEL_LABEL[item.impact.level] || 'New'}${item.impact.level ? ' impact' : ''}${item.impact.tags.length ? ' · ' + item.impact.tags.slice(0, 2).join(', ') : ''}`,
          body: item.title,
        };
    await Notifications.scheduleNotificationAsync({ content: { ...content, data: { url: item.link } }, trigger: null });
  }
  if (hits.length > MAX_SINGLE_ALERTS) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'TradeWire',
        body: `+${hits.length - MAX_SINGLE_ALERTS} more market-moving updates. Open the app to see them.`,
        data: {},
      },
      trigger: null,
    });
  }

  hits.forEach((i) => notified.add(i.id));
  await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified].slice(-500)));
  return hits.length;
}

// Must be defined at module scope so the OS can run it when the app is closed.
TaskManager.defineTask(TASK, async () => {
  try {
    await checkAndNotify();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Asks for notification permission. Returns false if the user declines. */
export async function enableAlerts(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Market-moving news',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const perm = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  const granted =
    perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) return false;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  return true;
}

export async function disableAlerts(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
}
