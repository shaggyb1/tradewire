import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { getAllIndices, type IndexQuote } from '../nse';
import { C } from '../theme';
import { nseState } from '../time';

const REFRESH_MS = (Platform.OS === 'web' ? 120 : 60) * 1000;
const SPEED_PX_PER_SEC = 36;

const TAPE: [string, string][] = [
  ['NIFTY 50', 'Nifty'],
  ['NIFTY BANK', 'Bank Nifty'],
  ['INDIA VIX', 'VIX'],
  ['NIFTY FINANCIAL SERVICES', 'Fin'],
  ['NIFTY IT', 'IT'],
  ['NIFTY AUTO', 'Auto'],
  ['NIFTY PHARMA', 'Pharma'],
  ['NIFTY FMCG', 'FMCG'],
  ['NIFTY METAL', 'Metal'],
  ['NIFTY REALTY', 'Realty'],
  ['NIFTY OIL & GAS', 'Oil & Gas'],
];

/** Scrolling strip of index levels, updated only while the screen is open. */
export default function TickerTape() {
  const [quotes, setQuotes] = useState<IndexQuote[]>([]);
  const [x] = useState(() => new Animated.Value(0));
  const [loopWidth, setLoopWidth] = useState(0);
  const [still, setStill] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = () => getAllIndices().then(setQuotes).catch(() => {});
      load();
      const timer = setInterval(() => {
        const st = nseState(Date.now());
        if (st === 'Open' || st === 'Pre-open') load();
      }, REFRESH_MS);
      return () => clearInterval(timer);
    }, []),
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loopWidth || still) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, {
        toValue: -loopWidth,
        duration: (loopWidth / SPEED_PX_PER_SEC) * 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [loopWidth, still, x]);

  const rows = TAPE.flatMap(([index, label]) => {
    const q = quotes.find((v) => v.index === index);
    return q ? [{ label, q }] : [];
  });
  if (!rows.length) return <View style={styles.empty} />;

  const strip = (hidden: boolean) => (
    <View
      style={styles.strip}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      onLayout={hidden ? undefined : (e) => setLoopWidth(e.nativeEvent.layout.width)}
    >
      {rows.map(({ label, q }) => (
        <View key={label} style={styles.item}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{q.last.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          <Text style={[styles.change, { color: q.percentChange >= 0 ? C.bull : C.bear }]}>
            {q.percentChange >= 0 ? '▲' : '▼'} {Math.abs(q.percentChange).toFixed(2)}%
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.track, { transform: [{ translateX: x }] }]}>
        {strip(false)}
        {strip(true)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { height: 34, borderBottomColor: C.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth },
  wrap: { height: 34, overflow: 'hidden', justifyContent: 'center', borderBottomColor: C.cardBorder, borderBottomWidth: StyleSheet.hairlineWidth },
  track: { flexDirection: 'row', alignSelf: 'flex-start' },
  strip: { flexDirection: 'row' },
  item: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 14 },
  label: { color: C.muted, fontSize: 12, fontWeight: '600' },
  value: { color: C.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
