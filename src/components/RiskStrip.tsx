import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { riskOutlook } from '../insights';
import { useStore } from '../store';
import { C } from '../theme';

/** One-line warning on eventful days; tap opens the calendar. Hidden on quiet days. */
export default function RiskStrip() {
  const { now, items, settings } = useStore();
  const router = useRouter();
  const today = useMemo(() => riskOutlook(now, items, settings.watchlist, 1)[0], [now, items, settings.watchlist]);
  if (today.level !== 'High' && today.level !== 'Medium') return null;
  const color = today.level === 'High' ? C.high : C.med;
  return (
    <Pressable onPress={() => router.navigate('/calendar')} style={[styles.strip, { borderColor: color }]}>
      <Text style={[styles.level, { color }]}>⚠ {today.level} event risk today</Text>
      <Text style={styles.why} numberOfLines={1}>
        {today.reasons.join(' · ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.card },
  level: { fontSize: 12, fontWeight: '800' },
  why: { color: C.muted, fontSize: 12, marginTop: 2 },
});
