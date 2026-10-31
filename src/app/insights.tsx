import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, MoodTrendChart } from '../components/Charts';
import { Aurora } from '../components/Hero';
import Reveal from '../components/Reveal';
import SignalMap from '../components/SignalMap';
import { dayLabel } from '../calendar';
import { moodTrend, riskOutlook, sectorHeat, trendWord, watchTrends } from '../insights';
import { useLayout } from '../layout';
import { getAllIndices, type IndexQuote } from '../nse';
import { openLink, useStore } from '../store';
import { C } from '../theme';

const RISK_COLOR = { High: C.high, Medium: C.med, Low: C.muted, Closed: C.faint } as const;
const PAD = 12;
const GAP = 14;
/** Inner padding and border of a card, either side */
const CARD_INSET = 26;

function Section({ title, delay, flex, children }: { title: string; delay: number; flex?: number; children: ReactNode }) {
  return (
    <Reveal delay={delay} style={flex ? { flex } : undefined}>
      <Text style={styles.h2}>{title}</Text>
      <View style={[styles.card, flex ? { flexGrow: 1 } : null]}>{children}</View>
    </Reveal>
  );
}

export default function InsightsScreen() {
  const { now, items, settings } = useStore();
  const { wide, contentWidth } = useLayout();
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

  const inner = contentWidth - PAD * 2;
  const mapW = (wide ? (inner - GAP) * (3 / 5) : inner) - CARD_INSET;
  const moodW = (wide ? (inner - GAP) / 2 : inner) - CARD_INSET;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadQuotes} tintColor={C.accent} colors={[C.accent]} />}>
        <View style={styles.pageHead}>
          <Aurora />
          <Reveal distance={20}>
            <Text style={[styles.h1, wide && styles.h1Wide]}>Insights</Text>
            <Text style={styles.sub}>Where today’s news is coming from, and which way it leans.</Text>
          </Reveal>
        </View>

        <View style={[styles.row, wide && styles.rowWide]}>
          <Section title="Signal map · last 24h" delay={80} flex={wide ? 3 : undefined}>
            <SignalMap items={items} enabled={settings.enabled} now={now} width={mapW} />
          </Section>

          <Section title="Event risk" delay={180} flex={wide ? 2 : undefined}>
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
          </Section>
        </View>

        <View style={[styles.row, wide && styles.rowWide]}>
          <Section title="News mood · 7 days" delay={280} flex={wide ? 1 : undefined}>
            <Text style={[styles.trend, { color: trend.dir > 0 ? C.bull : trend.dir < 0 ? C.bear : C.muted }]}>
              {trend.dir > 0 ? '▲ ' : trend.dir < 0 ? '▼ ' : '◆ '}
              {trend.word}
            </Text>
            <Text style={[styles.small, { marginBottom: 8 }]}>Last 3 days compared with the 4 days before</Text>
            <MoodTrendChart days={days} width={moodW} />
          </Section>

          <Section title="Sectors · last 24h" delay={380} flex={wide ? 1 : undefined}>
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
          </Section>
        </View>

        <Section title="★ Watchlist · 7 days" delay={480}>
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
        </Section>

        <Text style={styles.footer}>
          All insights are counts of keyword-tagged headlines and scheduled events. They describe the news flow, not where
          prices will go, and are not investment advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: PAD, paddingBottom: 32 },
  pageHead: { marginHorizontal: -PAD, paddingHorizontal: PAD + 4, paddingTop: 16, paddingBottom: 8, overflow: 'hidden' },
  h1: { color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  h1Wide: { fontSize: 52, letterSpacing: -1.8 },
  sub: { color: C.muted, fontSize: 14, marginTop: 2 },
  row: { gap: 0 },
  rowWide: { flexDirection: 'row', gap: GAP, alignItems: 'stretch' },
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
