import { StyleSheet, Text, View } from 'react-native';
import { useLayout } from '../layout';
import { useCountUp } from '../motion';
import { C } from '../theme';
import Reveal from './Reveal';

function Stat({ value, label, delay, color }: { value: number; label: string; delay: number; color?: string }) {
  const shown = useCountUp(value, 1100);
  return (
    <Reveal delay={delay} style={styles.tile}>
      <Text style={[styles.value, color ? { color } : null]}>{shown.toLocaleString('en-IN')}</Text>
      <Text style={styles.label}>{label}</Text>
    </Reveal>
  );
}

/** Today's numbers, counting up when the page opens and ticking over as news arrives. */
export default function StatBand({ live, headlines, high, up, down }: { live: number; headlines: number; high: number; up: number; down: number }) {
  const { wide } = useLayout();
  return (
    <View style={[styles.band, wide && styles.bandWide]}>
      <Stat delay={500} value={live} label="Sources live" />
      <Stat delay={580} value={headlines} label="Headlines · 24h" />
      <Stat delay={660} value={high} label="High impact · 24h" />
      <Stat delay={740} value={up} label="▲ Bullish · 24h" color={C.bull} />
      <Stat delay={820} value={down} label="▼ Bearish · 24h" color={C.bear} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  bandWide: { flexWrap: 'nowrap', paddingHorizontal: 24 },
  tile: { flexGrow: 1, flexBasis: 100, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 12, paddingVertical: 10 },
  value: { color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  label: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
