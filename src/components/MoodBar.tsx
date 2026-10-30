import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

interface Props {
  up: number;
  down: number;
  filter: 1 | -1 | null;
  onFilter: (f: 1 | -1 | null) => void;
}

/** Bullish vs bearish headline count. Tap a side to show only those headlines. */
export default function MoodBar({ up, down, filter, onFilter }: Props) {
  const total = up + down;
  if (total === 0 && filter === null) return null;

  const share = total ? up / total : 0.5;
  const verdict =
    total < 3 ? 'Too little news to judge' : share >= 0.6 ? 'Leaning bullish' : share <= 0.4 ? 'Leaning bearish' : 'Balanced';
  const verdictColor = total < 3 ? C.muted : share >= 0.6 ? C.bull : share <= 0.4 ? C.bear : C.muted;
  const toggle = (f: 1 | -1) => onFilter(filter === f ? null : f);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>News mood · 24h</Text>
        <Text style={[styles.verdict, { color: verdictColor }]}>{verdict}</Text>
      </View>
      <View style={styles.bar}>
        <View style={{ flex: Math.max(share, 0.02), backgroundColor: C.bull }} />
        <View style={{ flex: Math.max(1 - share, 0.02), backgroundColor: C.bear }} />
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => toggle(1)} hitSlop={8} style={[styles.side, filter === 1 && styles.sideOn]}>
          <Text style={[styles.count, { color: C.bull }]}>▲ {up} bullish</Text>
        </Pressable>
        {filter !== null && (
          <Pressable onPress={() => onFilter(null)} hitSlop={8}>
            <Text style={styles.clear}>Show all</Text>
          </Pressable>
        )}
        <Pressable onPress={() => toggle(-1)} hitSlop={8} style={[styles.side, filter === -1 && styles.sideOn]}>
          <Text style={[styles.count, { color: C.bear }]}>▼ {down} bearish</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.card, marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: C.cardBorder },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.muted, fontSize: 12, fontWeight: '700' },
  verdict: { fontSize: 12, fontWeight: '800' },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  side: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sideOn: { backgroundColor: C.chipActive },
  count: { fontSize: 12, fontWeight: '700' },
  clear: { color: C.accent, fontSize: 12 },
});
