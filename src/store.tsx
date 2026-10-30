import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import * as ScreenCapture from 'expo-screen-capture';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { disableAlerts, enableAlerts } from './alerts';
import { fetchSource, type NewsItem } from './feed';
import { authenticate, canLock } from './lock';
import { merge } from './merge';
import { SOURCES } from './sources';
import { clearAll, DEFAULT_SETTINGS, loadItems, loadSettings, saveItems, saveSettings, type Settings } from './storage';
import { C } from './theme';
import { matchWatch } from './watchlist';

/** Re-lock after the app has been in the background this long (allows opening articles). */
const RELOCK_AFTER_MS = 60 * 1000;
/** The website's requests all go through its server, which has a monthly limit */
const MIN_INTERVAL_SEC = Platform.OS === 'web' ? 120 : 0;

export function openLink(url: unknown) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return;
  WebBrowser.openBrowserAsync(url, { toolbarColor: C.bg, controlsColor: C.accent }).catch(() => {});
}

interface Store {
  ready: boolean;
  settings: Settings;
  items: NewsItem[];
  /** item id → matching watchlist term */
  watchMap: Map<string, string>;
  newIds: Set<string>;
  errors: Record<string, string>;
  loading: boolean;
  lastUpdated: number | null;
  now: number;
  locked: boolean;
  refresh: () => void;
  markRead: () => void;
  updateSettings: (s: Settings) => Promise<void>;
  clearData: () => Promise<void>;
  unlock: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);

  const itemsRef = useRef<NewsItem[]>([]);
  const settingsRef = useRef(settings);
  const busy = useRef(false);
  const lockedRef = useRef(false);
  const pendingLink = useRef<unknown>(null);
  useEffect(() => {
    settingsRef.current = settings;
    lockedRef.current = locked;
  }, [settings, locked]);

  const fetchAll = useCallback(async (enabled: string[]) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const srcs = SOURCES.filter((s) => enabled.includes(s.id));
    const results = await Promise.allSettled(srcs.map(fetchSource));
    const fresh: NewsItem[] = [];
    const errs: Record<string, string> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') fresh.push(...r.value);
      else errs[srcs[i].id] = r.reason?.name === 'AbortError' ? 'timed out' : String(r.reason?.message ?? r.reason);
    });
    const t = Date.now();
    const hadItems = itemsRef.current.length > 0;
    const { items: merged, added } = merge(itemsRef.current, fresh, t);
    itemsRef.current = merged;
    setItems(merged);
    if (hadItems && added.length) setNewIds((prev) => new Set([...prev, ...added]));
    setErrors(errs);
    setLastUpdated(t);
    setNow(t);
    setLoading(false);
    busy.current = false;
    saveItems(merged).catch(() => {});
  }, []);

  const refresh = useCallback(() => fetchAll(settingsRef.current.enabled), [fetchAll]);

  // Load cache + settings, then fetch
  useEffect(() => {
    (async () => {
      const [s, cached] = await Promise.all([loadSettings(), loadItems()]);
      itemsRef.current = cached;
      setItems(cached);
      setSettings(s);
      if (s.lockEnabled) setLocked(true);
      setReady(true);
      fetchAll(s.enabled);
      // Re-register in case the OS dropped the task (e.g. after an app update)
      if (s.alertLevel) enableAlerts().catch(() => {});
    })();
  }, [fetchAll]);

  // Auto-refresh while the app is open; refresh immediately when it comes back to the foreground
  useEffect(() => {
    if (!ready) return;
    let active = AppState.currentState === 'active';
    const tick = setInterval(() => active && refresh(), Math.max(settings.intervalSec, MIN_INTERVAL_SEC) * 1000);
    const clock = setInterval(() => active && setNow(Date.now()), 15000);
    const sub = AppState.addEventListener('change', (st) => {
      const wasActive = active;
      active = st === 'active';
      if (active && !wasActive) refresh();
    });
    return () => {
      clearInterval(tick);
      clearInterval(clock);
      sub.remove();
    };
  }, [ready, settings.enabled, settings.intervalSec, refresh]);

  useEffect(() => {
    if (settings.keepAwake) activateKeepAwakeAsync('desk').catch(() => {});
    else deactivateKeepAwake('desk').catch(() => {});
  }, [settings.keepAwake]);

  // Re-lock after time in the background
  useEffect(() => {
    if (!settings.lockEnabled) return;
    let bgAt = 0;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') bgAt = Date.now();
      else if (st === 'active' && bgAt && Date.now() - bgAt > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [settings.lockEnabled]);

  // Block screenshots; on Android this also blanks the recent-apps preview
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (settings.hideScreen) {
      ScreenCapture.preventScreenCaptureAsync('tw').catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync('tw').catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    }
  }, [settings.hideScreen]);

  // Tapping an alert opens its article (also when the tap launched the app); waits for unlock if locked
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (url: unknown) => {
      if (lockedRef.current) pendingLink.current = url;
      else openLink(url);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data?.url);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) open(r.notification.request.content.data?.url);
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    if (!(await authenticate())) return;
    setLocked(false);
    if (pendingLink.current) {
      openLink(pendingLink.current);
      pendingLink.current = null;
    }
  }, []);

  const updateSettings = useCallback(
    async (next: Settings) => {
      const prev = settingsRef.current;
      let s = next;
      const newlyEnabled = s.enabled.some((id) => !prev.enabled.includes(id));
      if (s.alertLevel !== prev.alertLevel) {
        if (s.alertLevel === 0) {
          disableAlerts().catch(() => {});
        } else if (prev.alertLevel === 0) {
          const ok = await enableAlerts().catch(() => false);
          if (!ok) {
            Alert.alert('Notifications are off', 'Allow notifications for TradeWire in your phone settings to get alerts.');
            s = { ...s, alertLevel: 0 };
          }
        }
      }
      if (s.lockEnabled && !prev.lockEnabled) {
        if (!(await canLock())) {
          Alert.alert('Set up a screen lock first', 'Add a fingerprint, face, PIN or pattern in your phone settings, then turn on App lock.');
          s = { ...s, lockEnabled: false };
        } else if (!(await authenticate('Confirm to turn on app lock'))) {
          s = { ...s, lockEnabled: false };
        }
      }
      setSettings(s);
      saveSettings(s).catch(() => {});
      if (newlyEnabled) fetchAll(s.enabled);
    },
    [fetchAll],
  );

  const clearData = useCallback(async () => {
    await disableAlerts().catch(() => {});
    await clearAll();
    itemsRef.current = [];
    setItems([]);
    setNewIds(new Set());
    setSettings(DEFAULT_SETTINGS);
    setLocked(false);
    fetchAll(DEFAULT_SETTINGS.enabled);
  }, [fetchAll]);

  const markRead = useCallback(() => setNewIds(new Set()), []);

  const watchMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!settings.watchlist.length) return m;
    for (const i of items) {
      const term = matchWatch(`${i.title} ${i.summary}`, settings.watchlist);
      if (term) m.set(i.id, term);
    }
    return m;
  }, [items, settings.watchlist]);

  const value = useMemo<Store>(
    () => ({ ready, settings, items, watchMap, newIds, errors, loading, lastUpdated, now, locked, refresh, markRead, updateSettings, clearData, unlock }),
    [ready, settings, items, watchMap, newIds, errors, loading, lastUpdated, now, locked, refresh, markRead, updateSettings, clearData, unlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
