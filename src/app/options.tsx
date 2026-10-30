import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, IntradayChart } from '../components/Charts';
import { intraday } from '../indicators';
import { getAllIndices, getChain, getExpiries, getFnoStocks, getIndexTicks, getStockTicks, OPTION_SYMBOLS, type Chain, type FnoStock, type IndexQuote, type Tick } from '../nse';
import { chainStats, nearAtm, pcrReading } from '../optionStats';
import { useStore } from '../store';
import { C, MAX_WIDTH } from '../theme';
import { istClock, nseState } from '../time';

const REFRESH_MS = (Platform.OS === 'web' ? 120 : 60) * 1000;
const fmt = (n: number, d = 2) => n.toLocaleString('en-IN', { maximumFractionDigits: d });
/** OI in lakh contracts-units, e.g. 1,46,529 → 1.47L */
const lakh = (n: number) => (Math.abs(n) >= 100000 ? `${(n / 100000).toFixed(2)}L` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${lakh(Math.abs(n))}`;

export default function OptionsScreen() {
  const { now } = useStore();
  const { width } = useWindowDimensions();
  const [symbol, setSymbol] = useState('NIFTY');
  const [stocks, setStocks] = useState<FnoStock[]>([]);
  const [stockQuery, setStockQuery] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [ticks, setTicks] = useState<{ prevClose: number; ticks: Tick[] } | null>(null);
  const [vix, setVix] = useState<IndexQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  /** Only the newest request may update the screen, so a slow old reply can never show the wrong symbol */
  const latest = useRef(0);

  const indexMeta = OPTION_SYMBOLS.find((s) => s.symbol === symbol);
  const indexName = indexMeta?.index;
  const label = indexMeta?.label ?? symbol;

  const selectSymbol = (s: string) => {
    setStockQuery('');
    if (s === symbol) return;
    latest.current++; // ignore replies still on their way for the previous symbol
    setLoading(false);
    setExpiries([]);
    setExpiry(null);
    setChain(null);
    setTicks(null);
    setSymbol(s);
  };

  // The stock list rarely changes: load it once
  useEffect(() => {
    getFnoStocks().then(setStocks).catch(() => {});
  }, []);

  const stockMatches = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    if (!q) return [];
    const rank = (s: FnoStock) => (s.symbol.toLowerCase().startsWith(q) ? 0 : s.name.toLowerCase().startsWith(q) ? 1 : 2);
    return stocks
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }, [stocks, stockQuery]);

  // New symbol, or a retry after a failure → load its expiries and pick the nearest
  useEffect(() => {
    let cancelled = false;
    getExpiries(symbol)
      .then((list) => {
        if (cancelled) return;
        setExpiries(list.slice(0, 4));
        setExpiry(list[0] ?? null);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [symbol, retryCount]);

  const load = useCallback(async () => {
    if (!expiry) return;
    const id = ++latest.current;
    setLoading(true);
    const [c, t, q] = await Promise.allSettled([getChain(symbol, expiry, indexName ? 'Indices' : 'Equity'), indexName ? getIndexTicks(indexName) : getStockTicks(symbol), getAllIndices()]);
    if (id !== latest.current) return;
    if (c.status === 'fulfilled') setChain(c.value);
    if (t.status === 'fulfilled') setTicks(t.value);
    if (q.status === 'fulfilled') setVix(q.value.find((x) => x.index === 'INDIA VIX') ?? null);
    const failed = [c, t].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    setError(failed ? (failed.reason instanceof Error ? failed.reason.message : String(failed.reason)) : null);
    setFetchedAt(Date.now());
    setLoading(false);
  }, [symbol, expiry, indexName]);

  // Manual refresh: if even the expiry list failed to load, start again from there
  const retry = () => (expiry ? load() : setRetryCount((n) => n + 1));

  // Load when the tab is open; refresh every minute during market hours
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => {
        const st = nseState(Date.now());
        if (st === 'Open' || st === 'Pre-open') load();
      }, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const stats = useMemo(() => (chain ? chainStats(chain) : null), [chain]);
  const rows = useMemo(() => (chain && stats ? nearAtm(chain, stats.atm, 8) : []), [chain, stats]);
  const tech = useMemo(() => (ticks ? intraday(ticks.ticks, ticks.prevClose) : null), [ticks]);
  const maxOI = Math.max(1, ...rows.flatMap((r) => [r.CE?.openInterest ?? 0, r.PE?.openInterest ?? 0]));
  const market = nseState(now);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Options & intraday</Text>
        <Text style={styles.small}>
          {loading ? 'Updating…' : fetchedAt ? `NSE ${market} · fetched ${istClock(fetchedAt)} IST` : 'Loading…'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={retry} tintColor={C.accent} colors={[C.accent]} />}>
        <View style={styles.row}>
          {OPTION_SYMBOLS.map((s) => (
            <Pressable key={s.symbol} onPress={() => selectSymbol(s.symbol)} style={[styles.chip, symbol === s.symbol && styles.chipOn]}>
              <Text style={styles.chipText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={stockQuery}
          onChangeText={setStockQuery}
          placeholder={`Search ${stocks.length || ''} F&O stocks: Reliance, TCS, SBI…`.replace('  ', ' ')}
          placeholderTextColor={C.faint}
          style={styles.stockSearch}
          autoCorrect={false}
          accessibilityLabel="Search F&O stocks"
        />
        {stockMatches.length > 0 && (
          <View style={[styles.row, { marginTop: 8 }]}>
            {stockMatches.map((s) => (
              <Pressable key={s.symbol} onPress={() => selectSymbol(s.symbol)} style={styles.chip} accessibilityLabel={s.name}>
                <Text style={styles.chipText}>{s.symbol}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!!stockQuery.trim() && !stockMatches.length && stocks.length > 0 && <Text style={[styles.small, { marginTop: 8 }]}>No F&O stock matches that.</Text>}
        {!indexMeta && (
          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={[styles.chip, styles.chipOn]}>
              <Text style={styles.chipText}>{symbol}</Text>
            </View>
          </View>
        )}
        {expiries.length > 0 && (
          <View style={[styles.row, { marginTop: 8 }]}>
            {expiries.map((e) => (
              <Pressable key={e} onPress={() => setExpiry(e)} style={[styles.chip, styles.chipSmall, expiry === e && styles.chipOn]}>
                <Text style={styles.chipTextSmall}>{e.slice(0, 6)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && (
          <View style={[styles.card, { borderColor: C.high, borderWidth: 1 }]}>
            <Text style={{ color: C.high, fontWeight: '700' }}>Couldn’t load NSE data</Text>
            <Text style={styles.small}>{error}</Text>
            <Pressable onPress={retry} style={[styles.chip, styles.retry]} accessibilityRole="button">
              <Text style={styles.chipText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Intraday */}
        {tech && ticks && (
          <>
            <Text style={styles.h2}>{label} · intraday</Text>
            <View style={styles.card}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{fmt(tech.last)}</Text>
                <Text style={[styles.change, { color: tech.change >= 0 ? C.bull : C.bear }]}>
                  {tech.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(tech.change))} ({Math.abs(tech.pct).toFixed(2)}%)
                </Text>
              </View>
              {vix && (
                <Text style={styles.small}>
                  India VIX {vix.last.toFixed(2)} ({vix.percentChange >= 0 ? '▲' : '▼'}
                  {Math.abs(vix.percentChange).toFixed(2)}%)
                </Text>
              )}
              <View style={{ marginTop: 10 }}>
                <IntradayChart ticks={ticks.ticks} prevClose={ticks.prevClose} width={Math.min(width, MAX_WIDTH) - 50} />
              </View>
            </View>

            <Text style={styles.h2}>Indicators · 5-min candles</Text>
            <View style={styles.card}>
              {tech.readings.map((r) => (
                <View key={r.label} style={styles.readRow}>
                  <Text style={[styles.readDir, { color: r.dir > 0 ? C.bull : r.dir < 0 ? C.bear : C.muted }]}>
                    {r.dir > 0 ? '▲' : r.dir < 0 ? '▼' : '◆'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.readHead}>
                      <Text style={styles.readLabel}>{r.label}</Text>
                      <Text style={styles.readValue}>{r.value}</Text>
                    </View>
                    <Text style={styles.small}>{r.note}</Text>
                  </View>
                </View>
              ))}
              <Text style={[styles.small, { marginTop: 6 }]}>
                Up {tech.readings.filter((r) => r.dir > 0).length} · Down {tech.readings.filter((r) => r.dir < 0).length} ·
                Neutral {tech.readings.filter((r) => r.dir === 0).length}
              </Text>
            </View>
          </>
        )}

        {/* Option chain analysis */}
        {chain && !stats && (
          <View style={styles.card}>
            <Text style={styles.small}>NSE has no option data for this expiry right now. Try another expiry.</Text>
          </View>
        )}
        {stats && chain && (
          <>
            <Text style={styles.h2}>
              Option chain · {expiry} · as of {chain.timestamp.slice(12, 17)}
            </Text>
            <View style={styles.statsGrid}>
              <Stat label="PCR (OI)" value={stats.pcr.toFixed(2)} note={pcrReading(stats.pcr)} />
              <Stat label="Max pain" value={fmt(stats.maxPain, 0)} note={`Spot ${fmt(stats.spot)} · ${stats.spot >= stats.maxPain ? 'above' : 'below'} max pain`} />
              <Stat label="Call wall" value={fmt(stats.callWall, 0)} note="Highest call OI — often watched as resistance" />
              <Stat label="Put wall" value={fmt(stats.putWall, 0)} note="Highest put OI — often watched as support" />
              <Stat label="ATM IV" value={`${stats.atmIv.toFixed(1)}%`} note={`ATM strike ${fmt(stats.atm, 0)}`} />
              <Stat
                label="Implied move"
                value={`±${fmt(stats.straddle, 0)}`}
                note={`ATM straddle ≈ ${fmt(stats.spot - stats.straddle, 0)} – ${fmt(stats.spot + stats.straddle, 0)} by expiry`}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.small}>
                Biggest call OI added: {stats.callBuild ? `${fmt(stats.callBuild.strike, 0)} (${signed(stats.callBuild.change)})` : '—'}
                {'\n'}Biggest put OI added: {stats.putBuild ? `${fmt(stats.putBuild.strike, 0)} (${signed(stats.putBuild.change)})` : '—'}
                {'\n'}Total OI: calls {lakh(stats.totalCallOI)} · puts {lakh(stats.totalPutOI)}
              </Text>
            </View>

            <View style={[styles.card, { marginTop: 8, paddingHorizontal: 6 }]}>
              <View style={styles.tHead}>
                <Text style={[styles.th, styles.side]}>CALLS · OI / ΔOI / LTP</Text>
                <Text style={[styles.th, styles.strikeCol]}>Strike</Text>
                <Text style={[styles.th, styles.side, { textAlign: 'right' }]}>LTP / ΔOI / OI · PUTS</Text>
              </View>
              {rows.map((r) => {
                const atm = r.strikePrice === stats.atm;
                const ceItm = r.strikePrice < stats.spot;
                return (
                  <View key={r.strikePrice} style={[styles.tRow, atm && styles.atmRow]}>
                    <View style={[styles.side, ceItm && styles.itm]}>
                      <Bar value={r.CE?.openInterest ?? 0} max={maxOI} color={C.downMark} align="right" />
                      <Text style={styles.td}>
                        {lakh(r.CE?.openInterest ?? 0)} · {signed(r.CE?.changeinOpenInterest ?? 0)} · {fmt(r.CE?.lastPrice ?? 0)}
                      </Text>
                    </View>
                    <Text style={[styles.strike, styles.strikeCol, atm && { color: C.accent }]}>{fmt(r.strikePrice, 0)}</Text>
                    <View style={[styles.side, !ceItm && !atm && styles.itm]}>
                      <Bar value={r.PE?.openInterest ?? 0} max={maxOI} color={C.upMark} />
                      <Text style={[styles.td, { textAlign: 'right' }]}>
                        {fmt(r.PE?.lastPrice ?? 0)} · {signed(r.PE?.changeinOpenInterest ?? 0)} · {lakh(r.PE?.openInterest ?? 0)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.legend}>
                <View style={[styles.swatch, { backgroundColor: C.downMark }]} />
                <Text style={styles.small}>Call OI</Text>
                <View style={[styles.swatch, { backgroundColor: C.upMark, marginLeft: 12 }]} />
                <Text style={styles.small}>Put OI</Text>
                <Text style={[styles.small, { marginLeft: 12 }]}>Shaded = in the money · highlighted strike = ATM</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.footer}>
          Data from the nseindia.com website (not an official API): may be delayed, and may stop working if NSE changes its
          site. Sensex (BSE) and crude oil (MCX) aren’t included because those exchanges block this kind of access. Indicators describe what price and open interest are doing; they are not buy or sell signals or investment
          advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : C.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  h1: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  h2: { color: C.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, marginLeft: 4 },
  content: { paddingHorizontal: 12, paddingBottom: 32, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { backgroundColor: C.chip, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5 },
  stockSearch: { backgroundColor: C.card, color: C.text, borderRadius: 10, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginTop: 8 },
  chipOn: { backgroundColor: C.chipActive },
  retry: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: C.chipActive },
  chipText: { color: C.text, fontWeight: '600', fontSize: 13 },
  chipTextSmall: { color: C.text, fontSize: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.cardBorder },
  small: { color: C.muted, fontSize: 12, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { color: C.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  change: { fontSize: 14, fontWeight: '700' },
  readRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomColor: C.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth },
  readDir: { fontSize: 14, fontWeight: '800', width: 16, marginTop: 1 },
  readHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  readLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
  readValue: { color: C.text, fontSize: 12, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { backgroundColor: C.card, borderRadius: 14, padding: 10, width: '48.5%', borderWidth: 1, borderColor: C.cardBorder },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  statNote: { color: C.muted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  tHead: { flexDirection: 'row', paddingBottom: 6, borderBottomColor: C.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth },
  th: { color: C.muted, fontSize: 9, fontWeight: '800' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  atmRow: { backgroundColor: C.chip, borderRadius: 6 },
  side: { flex: 1, gap: 3, paddingHorizontal: 4 },
  itm: { backgroundColor: C.chip, borderRadius: 4 },
  strikeCol: { width: 64, textAlign: 'center' },
  strike: { color: C.text, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  td: { color: C.text, fontSize: 10, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  footer: { color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 16, textAlign: 'center' },
});
