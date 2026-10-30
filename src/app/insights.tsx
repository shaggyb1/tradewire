import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, MoodTrendChart } from '../components/Charts';
import SignalMap from '../components/SignalMap';
import { dayLabel } from '../calendar';
import { moodTrend, riskOutlook, sectorHeat, trendWord, watchTrends } from '../insights';
import { getAllIndices, type IndexQuote } from '../nse';
import { openLink, useStore } from '../store';
import { C, MAX_WIDTH } from '../theme';

const RISK_COLOR = { High: C.high, Medium: C.med, Low: C.muted, Closed: C.faint } as const;

export default function InsightsScreen() {
  const { now, items, settings } = useStore();
  const { width } = useWindowDimensions();
  const [quotes, setQuotes] = useState<IndexQuote[]>([]);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      setQuotes(await getAllIndices());
      setQuoteErr(null);
    } catch (e) {
      setQuoteErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  // Fetch sector index moves only while this tab is open
  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [loadQuotes]),
  );

  const risk = useMemo(() => riskOutlook(now, items, settings.watchlist, 3), [now, items, settings.watchlist]);
  const days = useMemo(() => moodTrend(items, now), [items, now]);
  const trend = trendWord(days);
  const sectors = useMemo(() => sectorHeat(items, now, quotes), [items, now, quotes]);
  const watch = useMemo(() => watchTrends(items, settings.watchlist, now), [items, settings.watchlist, now]);
  const maxSector = Math.max(1, ...sectors.map((s) => Math.max(s.up, s.down)));
  const vix = quotes.find((q) => q.index === 'INDIA VIX');
  const chartW = Math.min(width, MAX_WIDTH) - 24 - 24 - 2;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Text style={styles.h1}>Insights</Text>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadQuotes} tintColor={C.accent} colors={[C.accent]} />}>
        <Text style={styles.h2}>Signal map · last 24h</Text>
        <View style={styles.card}>
          <SignalMap items={items} enabled={settings.enabled} now={now} width={chartW} />
        </View>

        {/* 4. Event risk */}
        <Text style={styles.h2}>Event risk</Text>
        <View style={styles.card}>
          {risk.map((r) => (
            <View key={r.date} style={styles.riskRow}>
              <Text style={styles.riskDay}>{dayLabel(r.date, now)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskLevel, { color: RISK_COLOR[r.level] }]}>
                  {r.level === 'High' ? '⚠ ' : r.level === 'Medium' ? '◆ ' : '○ '}
                  {r.level === 'Closed' ? 'Market closed' : `${r.level} risk`}
                </Text>
                <Text style={styles.small}>{r.reasons.join(' · ')}</Text>
              </View>
            </View>
          ))}
          {vix && (
            <Text style={[styles.small, { marginTop: 8 }]}>
              India VIX {vix.last.toFixed(2)} ({vix.percentChange >= 0 ? '▲' : '▼'} {Math.abs(vix.percentChange).toFixed(2)}%) —{' '}
              {vix.last >= 20 ? 'high expected volatility' : vix.last <= 12 ? 'low expected volatility' : 'normal expected volatility'}
            </Text>
          )}
        </View>

        {/* 3. 7-day mood */}
        <Text style={styles.h2}>News mood · 7 days</Text>
        <View style={styles.card}>
          <Text style={[styles.trend, { color: trend.dir > 0 ? C.bull : trend.dir < 0 ? C.bear : C.muted }]}>
            {trend.dir > 0 ? '▲ ' : trend.dir < 0 ? '▼ ' : '◆ '}
            {trend.word}
          </Text>
          <Text style={[styles.small, { marginBottom: 8 }]}>Last 3 days compared with the 4 days before</Text>
          <MoodTrendChart days={days} width={chartW} />
        </View>

        {/* 1. Sector heatmap */}
        <Text style={styles.h2}>Sectors · last 24h</Text>
        <View style={styles.card}>
          {sectors.length === 0 && <Text style={styles.small}>No sector-moving news in the last 24 hours.</Text>}
          {sectors.map((s) => (
            <View key={s.sector} style={styles.sectorRow}>
              <Text style={styles.sectorName} numberOfLines={1}>
                {s.sector}
              </Text>
              <View style={styles.sectorBars}>
                <Bar value={s.down} max={maxSector} color={C.downMark} align="right" />
                <View style={styles.mid} />
                <Bar value={s.up} max={maxSector} color={C.upMark} />
              </View>
              <Text style={styles.sectorCount}>
                ▲{s.up} ▼{s.down}
              </Text>
              <Text style={styles.sectorPct}>
                {s.indexPct == null ? '—' : `${s.indexPct >= 0 ? '▲' : '▼'}${Math.abs(s.indexPct).toFixed(2)}%`}
              </Text>
            </View>
          ))}
          <Text style={[styles.small, { marginTop: 8 }]}>
            Bars: count of news pushing each sector ▼ down (left) or ▲ up (right). Last column: today’s move of the matching
            NSE sector index{quoteErr ? ` (unavailable: ${quoteErr})` : ''}.
          </Text>
        </View>

        {/* 2. Watchlist trend */}
        <Text style={styles.h2}>★ Watchlist · 7 days</Text>
        <View style={styles.card}>
          {!watch.length && <Text style={styles.small}>Add stocks or topics in the Settings tab to see their news trend.</Text>}
          {watch.map((w) => (
            <Pressable key={w.term} disabled={!w.latest} onPress={() => w.latest && openLink(w.latest.link)} style={styles.watchRow}>
              <View style={styles.watchHead}>
                <Text style={styles.watchTerm}>★ {w.term}</Text>
                <Text style={[styles.watchTrend, { color: w.trend.dir > 0 ? C.bull : w.trend.dir < 0 ? C.bear : C.muted }]}>
                  {w.total ? `${w.trend.dir > 0 ? '▲' : w.trend.dir < 0 ? '▼' : '◆'} ${w.trend.word}` : 'No news'}
                </Text>
              </View>
              <Text style={styles.small}>
                {w.total} item{w.total === 1 ? '' : 's'} · ▲ {w.up} bullish · ▼ {w.down} bearish
              </Text>
              {w.latest && (
                <Text style={styles.latest} numberOfLines={2}>
                  Latest: {w.latest.title}
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>
          All insights are counts of keyword-tagged headlines and scheduled events. They describe the news flow, not where
          prices will go, and are not investment advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : C.bg },
  h1: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  content: { paddingHorizontal: 12, paddingBottom: 32, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  h2: { color: C.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.cardBorder },
  small: { color: C.muted, fontSize: 12, lineHeight: 17 },
  riskRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  riskDay: { color: C.text, fontSize: 13, fontWeight: '700', width: 82 },
  riskLevel: { fontSize: 13, fontWeight: '800' },
  trend: { fontSize: 16, fontWeight: '800' },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  sectorName: { color: C.text, fontSize: 13, width: 92 },
  sectorBars: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  mid: { width: 2, height: 12, backgroundColor: C.grid, marginHorizontal: 1 },
  sectorCount: { color: C.muted, fontSize: 11, width: 44, textAlign: 'right' },
  sectorPct: { color: C.text, fontSize: 11, width: 58, textAlign: 'right', fontVariant: ['tabular-nums'] },
  watchRow: { paddingVertical: 8, borderBottomColor: C.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  watchHead: { flexDirection: 'row', justifyContent: 'space-between' },
  watchTerm: { color: C.accent, fontSize: 14, fontWeight: '700' },
  watchTrend: { fontSize: 13, fontWeight: '700' },
  latest: { color: C.text, fontSize: 12, marginTop: 2 },
  footer: { color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 16, textAlign: 'center' },
});
