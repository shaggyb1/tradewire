import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MoodBar from './src/components/MoodBar';
import NewsCard from './src/components/NewsCard';
import SettingsSheet from './src/components/SettingsSheet';
import { disableAlerts, enableAlerts } from './src/alerts';
import { fetchSource, type NewsItem } from './src/feed';
import { merge } from './src/merge';
import { SOURCE_BY_ID, SOURCES } from './src/sources';
import { clearAll, DEFAULT_SETTINGS, loadItems, loadSettings, saveItems, saveSettings, type Settings } from './src/storage';
import { C } from './src/theme';
import { istClock, nseState } from './src/time';

type Tab = 'All' | 'India' | 'Global' | 'High';
const TABS: { key: Tab; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'India', label: '🇮🇳 India' },
  { key: 'Global', label: '🌐 Global' },
  { key: 'High', label: '⚡ High impact' },
];

const MOOD_WINDOW_MS = 24 * 3600 * 1000;

function openLink(url: unknown) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return;
  WebBrowser.openBrowserAsync(url, { toolbarColor: C.bg, controlsColor: C.accent }).catch(() => {});
}

function Main() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('All');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toneFilter, setToneFilter] = useState<1 | -1 | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);

  const itemsRef = useRef<NewsItem[]>([]);
  const busy = useRef(false);
  const listRef = useRef<FlatList<NewsItem>>(null);

  const refresh = useCallback(async (enabled: string[]) => {
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

  // Load cache + settings, then fetch
  useEffect(() => {
    (async () => {
      const [s, cached] = await Promise.all([loadSettings(), loadItems()]);
      itemsRef.current = cached;
      setItems(cached);
      setSettings(s);
      setReady(true);
      refresh(s.enabled);
      // Re-register in case the OS dropped the task (e.g. after an app update)
      if (s.alertLevel) enableAlerts().catch(() => {});
    })();
  }, [refresh]);

  // Auto-refresh while the app is open; refresh immediately when it comes back to the foreground
  useEffect(() => {
    if (!ready) return;
    let active = AppState.currentState === 'active';
    const tick = setInterval(() => {
      if (active) refresh(settings.enabled);
    }, settings.intervalSec * 1000);
    const clock = setInterval(() => active && setNow(Date.now()), 15000);
    const sub = AppState.addEventListener('change', (st) => {
      const wasActive = active;
      active = st === 'active';
      if (active && !wasActive) refresh(settings.enabled);
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

  // Tapping an alert opens its article (also when the tap launched the app)
  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) openLink(last.notification.request.content.data?.url);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) openLink(r.notification.request.content.data?.url);
    });
    return () => sub.remove();
  }, []);

  const updateSettings = async (s: Settings) => {
    const newlyEnabled = s.enabled.some((id) => !settings.enabled.includes(id));
    if (s.alertLevel !== settings.alertLevel) {
      if (s.alertLevel === 0) {
        disableAlerts().catch(() => {});
      } else if (settings.alertLevel === 0) {
        const ok = await enableAlerts().catch(() => false);
        if (!ok) {
          Alert.alert('Notifications are off', 'Allow notifications for TradeWire in your phone settings to get alerts.');
          s = { ...s, alertLevel: 0 };
        }
      }
    }
    setSettings(s);
    saveSettings(s).catch(() => {});
    if (newlyEnabled) refresh(s.enabled);
  };

  const onClearData = async () => {
    await disableAlerts().catch(() => {});
    await clearAll();
    itemsRef.current = [];
    setItems([]);
    setNewIds(new Set());
    setSettings(DEFAULT_SETTINGS);
    setShowSettings(false);
    refresh(DEFAULT_SETTINGS.enabled);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const src = SOURCE_BY_ID[i.sourceId];
      if (!settings.enabled.includes(i.sourceId)) return false;
      if (sourceFilter && i.sourceId !== sourceFilter) return false;
      if (tab === 'India' && src.region !== 'India') return false;
      if (tab === 'Global' && src.region !== 'Global') return false;
      if (tab === 'High' && i.impact.level < 3) return false;
      if (q && !`${i.title} ${i.summary} ${src.name} ${i.impact.tags.join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, settings.enabled, sourceFilter, tab, query]);

  // News mood over the last 24h of whatever the tabs/search currently show
  const mood = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const i of filtered) {
      if (now - i.time > MOOD_WINDOW_MS) continue;
      if (i.impact.tone.dir > 0) up++;
      else if (i.impact.tone.dir < 0) down++;
    }
    return { up, down };
  }, [filtered, now]);

  const visible = useMemo(
    () => (toneFilter ? filtered.filter((i) => i.impact.tone.dir === toneFilter) : filtered),
    [filtered, toneFilter],
  );

  const newCount = useMemo(() => visible.filter((i) => newIds.has(i.id)).length, [visible, newIds]);

  const onOpen = useCallback((item: NewsItem) => openLink(item.link), []);

  const onShare = useCallback((item: NewsItem) => {
    Share.share({ message: `${item.title}\n${item.link}` }).catch(() => {});
  }, []);

  const market = nseState(now);
  const enabledSources = SOURCES.filter((s) => settings.enabled.includes(s.id));
  const failed = Object.keys(errors).length;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>TradeWire</Text>
          <Text style={styles.updated}>
            <Text style={{ color: loading ? C.med : C.open }}>● </Text>
            {loading ? 'Updating…' : lastUpdated ? `Updated ${istClock(lastUpdated, true)} IST` : 'Connecting…'}
            {failed > 0 && <Text style={{ color: C.high }}>{`  ·  ${failed} source${failed > 1 ? 's' : ''} failed`}</Text>}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.market, market === 'Open' && { color: C.open, borderColor: C.open }]}>NSE {market}</Text>
          <Pressable onPress={() => setShowSettings(true)} hitSlop={12} accessibilityLabel="Settings">
            <Text style={styles.gear}>⚙︎</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search: repo, crude, Reliance, SEBI…"
        placeholderTextColor={C.faint}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.key && { color: C.text }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setSourceFilter(null)} style={[styles.chip, !sourceFilter && styles.chipOn]}>
            <Text style={styles.chipText}>All sources</Text>
          </Pressable>
          {enabledSources.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSourceFilter(sourceFilter === s.id ? null : s.id)}
              style={[styles.chip, sourceFilter === s.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, errors[s.id] && { color: C.high }]}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <MoodBar up={mood.up} down={mood.down} filter={toneFilter} onFilter={setToneFilter} />

      {newCount > 0 && (
        <Pressable
          style={styles.newBanner}
          onPress={() => {
            setNewIds(new Set());
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        >
          <Text style={styles.newBannerText}>↑ {newCount} new update{newCount > 1 ? 's' : ''} · tap to mark read</Text>
        </Pressable>
      )}

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <NewsCard item={item} now={now} isNew={newIds.has(item.id)} onOpen={onOpen} onShare={onShare} />
        )}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={() => refresh(settings.enabled)}
            tintColor={C.accent}
            colors={[C.accent]}
            progressBackgroundColor={C.card}
          />
        }
        initialNumToRender={12}
        windowSize={9}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading || !ready ? 'Fetching from official sources…' : 'No matching news.'}</Text>
        }
        ListFooterComponent={
          visible.length > 0 ? (
            <Text style={styles.footer}>Tap to open the source · long-press to share{'\n'}Tags and ▲▼ indicators are automatic, not advice.</Text>
          ) : null
        }
      />

      <SettingsSheet
        visible={showSettings}
        settings={settings}
        errors={errors}
        onChange={updateSettings}
        onClearData={onClearData}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  logo: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  updated: { color: C.muted, fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  market: { color: C.muted, fontSize: 11, fontWeight: '700', borderColor: C.none, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  gear: { color: C.text, fontSize: 24 },
  search: { backgroundColor: C.card, color: C.text, marginHorizontal: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  tabs: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, backgroundColor: C.card, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabOn: { backgroundColor: C.chipActive },
  tabText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  chip: { backgroundColor: C.chip, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipOn: { backgroundColor: C.chipActive },
  chipText: { color: C.text, fontSize: 12 },
  newBanner: { backgroundColor: C.open, marginHorizontal: 12, marginBottom: 8, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  newBannerText: { color: C.bg, fontWeight: '700', fontSize: 13 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 48 },
  footer: { color: C.faint, textAlign: 'center', fontSize: 11, marginTop: 12, lineHeight: 16 },
});
