import { StyleSheet, Text, View } from 'react-native';
import { useLayout } from '../layout';
import { useCountUp } from '../motion';
import { C } from '../theme';
import Reveal from './Reveal';

function Stat({ value, label, short, delay, color }: { value: number; label: string; short: string; delay: number; color?: string }) {
  const { compact } = useLayout();
  const shown = useCountUp(value, 1100);
  return (
    <Reveal delay={delay} style={[styles.tile, compact && styles.tileCompact]}>
      <Text style={[styles.value, compact && styles.valueCompact, color ? { color } : null]} numberOfLines={1}>
        {shown.toLocaleString('en-IN')}
      </Text>
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={compact ? 1 : undefined} accessibilityLabel={label}>
        {compact ? short : label}
      </Text>
    </Reveal>
  );
}

/** Today's numbers, counting up when the page opens and ticking over as news arrives. */
export default function StatBand({ live, headlines, high, up, down }: { live: number; headlines: number; high: number; up: number; down: number }) {
  const { wide, compact } = useLayout();
  return (
    <View style={[styles.band, wide && styles.bandWide, compact && styles.bandCompact]}>
      <Stat delay={500} value={live} label="Sources live" short="Live" />
      <Stat delay={580} value={headlines} label="Headlines · 24h" short="News" />
      <Stat delay={660} value={high} label="High impact · 24h" short="High" />
      <Stat delay={740} value={up} label="▲ Bullish · 24h" short="▲ Bull" color={C.bull} />
      <Stat delay={820} value={down} label="▼ Bearish · 24h" short="▼ Bear" color={C.bear} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  bandWide: { flexWrap: 'nowrap', paddingHorizontal: 24 },
  tile: { flexGrow: 1, flexBasis: 100, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 12, paddingVertical: 10 },
  value: { color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  label: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  bandCompact: { flexWrap: 'nowrap', gap: 5 },
  tileCompact: { flexBasis: 0, minWidth: 0, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 6, alignItems: 'center' },
  valueCompact: { fontSize: 17, letterSpacing: -0.4 },
  labelCompact: { fontSize: 10, marginTop: 0 },
});
