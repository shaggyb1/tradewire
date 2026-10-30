import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Icons';
import MoodBar from '../components/MoodBar';
import NewsCard from '../components/NewsCard';
import RiskStrip from '../components/RiskStrip';
import TickerTape from '../components/TickerTape';
import type { NewsItem } from '../feed';
import { SOURCE_BY_ID, SOURCES } from '../sources';
import { openLink, useStore } from '../store';
import { C, MAX_WIDTH } from '../theme';
import { istClock, nseState } from '../time';

type Tab = 'All' | 'India' | 'Global' | 'High' | 'Watch';
const TABS: { key: Tab; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'India', label: '🇮🇳 India' },
  { key: 'Global', label: '🌐 Global' },
  { key: 'High', label: '⚡ High' },
  { key: 'Watch', label: '★ Watch' },
];

const MOOD_WINDOW_MS = 24 * 3600 * 1000;

export default function NewsScreen() {
  const { ready, settings, items, watchMap, newIds, errors, loading, lastUpdated, now, refresh, markRead } = useStore();
  const [tab, setTab] = useState<Tab>('All');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toneFilter, setToneFilter] = useState<1 | -1 | null>(null);
  const listRef = useRef<FlatList<NewsItem>>(null);
  const wide = useWindowDimensions().width >= 700;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const src = SOURCE_BY_ID[i.sourceId];
      if (!settings.enabled.includes(i.sourceId)) return false;
      if (sourceFilter && i.sourceId !== sourceFilter) return false;
      if (tab === 'India' && src.region !== 'India') return false;
      if (tab === 'Global' && src.region !== 'Global') return false;
      if (tab === 'High' && i.impact.level < 3) return false;
      if (tab === 'Watch' && !watchMap.has(i.id)) return false;
      if (q && !`${i.title} ${i.summary} ${src.name} ${i.impact.tags.join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, settings.enabled, sourceFilter, tab, query, watchMap]);

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
      <TickerTape />
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <NewsCard
            item={item}
            now={now}
            isNew={newIds.has(item.id)}
            watched={watchMap.get(item.id) ?? null}
            onOpen={onOpen}
            onShare={onShare}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={refresh}
            tintColor={C.accent}
            colors={[C.accent]}
            progressBackgroundColor={C.card}
          />
        }
        initialNumToRender={12}
        windowSize={9}
        ListHeaderComponent={
          <View>
                <View style={styles.header}>
                  <View style={styles.brand}>
                    <Logo />
                    <Text style={styles.logo}>TradeWire</Text>
                  </View>
                  <Text
                    style={[
                      styles.market,
                      market === 'Open' && { color: C.open, borderColor: C.open },
                      market === 'Holiday' && { color: C.bear, borderColor: C.bear },
                    ]}
                  >
                    NSE {market}
                  </Text>
                </View>
          
                <View style={styles.hero}>
                  <Text style={styles.eyebrow}>Official sources · India & global</Text>
                  <Text style={[styles.heroTitle, wide && styles.heroTitleWide]}>
                    Market news, <Text style={styles.mark}> from the source. </Text>
                  </Text>
                  <Text style={styles.updated}>
                    <Text style={{ color: loading ? C.med : C.open }}>● </Text>
                    {loading ? 'Updating…' : lastUpdated ? `Updated ${istClock(lastUpdated, true)} IST` : 'Connecting…'}
                    {' · '}
                    {enabledSources.length - failed} of {enabledSources.length} sources live
                    {failed > 0 && <Text style={{ color: C.high }}>{` · ${failed} failed`}</Text>}
                  </Text>
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
          
                <RiskStrip />
                <MoodBar up={mood.up} down={mood.down} filter={toneFilter} onFilter={setToneFilter} />
          
                {newCount > 0 && (
                  <Pressable
                    style={styles.newBanner}
                    onPress={() => {
                      markRead();
                      listRef.current?.scrollToOffset({ offset: 0, animated: true });
                    }}
                  >
                    <Text style={styles.newBannerText}>↑ {newCount} new update{newCount > 1 ? 's' : ''} · tap to mark read</Text>
                  </Pressable>
                )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading || !ready
              ? 'Fetching from official sources…'
              : tab === 'Watch' && !settings.watchlist.length
                ? 'Your watchlist is empty.\nAdd stocks or topics in the Settings tab.'
                : 'No matching news.'}
          </Text>
        }
        ListFooterComponent={
          visible.length > 0 ? (
            <Text style={styles.footer}>Tap to open the source · long-press to share{'\n'}Tags and ▲▼ indicators are automatic, not advice.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : C.bg },
  listContent: { paddingTop: 4, paddingBottom: 32, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  hero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 8 },
  eyebrow: { color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { color: C.text, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.2 },
  heroTitleWide: { fontSize: 60, lineHeight: 68, letterSpacing: -2.4 },
  mark: { backgroundColor: C.accent, color: C.accentInk },
  updated: { color: C.muted, fontSize: 12, marginTop: 2 },
  market: { color: C.muted, fontSize: 11, fontWeight: '700', borderColor: C.none, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  search: { backgroundColor: C.card, color: C.text, marginHorizontal: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  tabs: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, backgroundColor: C.card, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabOn: { backgroundColor: C.chipActive },
  tabText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  chip: { backgroundColor: C.chip, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipOn: { backgroundColor: C.chipActive },
  chipText: { color: C.text, fontSize: 12 },
  newBanner: { backgroundColor: C.open, marginHorizontal: 12, marginBottom: 8, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  newBannerText: { color: C.bg, fontWeight: '700', fontSize: 13 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 48 },
  footer: { color: C.faint, textAlign: 'center', fontSize: 11, marginTop: 12, lineHeight: 16 },
});
