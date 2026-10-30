import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';
import { inSession } from '../indicators';
import type { DayMood } from '../insights';
import type { Tick } from '../nse';
import { C } from '../theme';

const IST_MS = 330 * 60000;
const hm = (t: number) => new Date(t + IST_MS).toISOString().slice(11, 16);
const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ---------- Intraday line ----------

interface LineProps {
  ticks: Tick[];
  prevClose: number;
  width: number;
  height?: number;
}

/** Minute prices for the session with a dashed previous-close line. Touch and drag to read values. */
export function IntradayChart({ ticks, prevClose, width, height = 150 }: LineProps) {
  const pts = useMemo(() => ticks.filter(inSession), [ticks]);
  const [hover, setHover] = useState<number | null>(null);
  if (width <= 0) return null;
  if (pts.length < 2) return <Text style={styles.empty}>No intraday data yet</Text>;

  const prices = pts.map((p) => p.price).concat(prevClose ? [prevClose] : []);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (width - 2) + 1;
  const y = (p: number) => height - ((p - lo) / (hi - lo)) * height;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
  const last = pts[pts.length - 1].price;
  const color = last >= prevClose ? C.upMark : C.downMark;

  const onTouch = (e: GestureResponderEvent) => {
    const fx = Math.min(Math.max(e.nativeEvent.locationX, 0), width);
    const target = t0 + (fx / width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - target) < Math.abs(pts[best].t - target)) best = i;
    setHover(best);
  };
  const h = hover != null ? pts[hover] : null;

  return (
    <View>
      <Text style={styles.readout}>
        {h
          ? `${hm(h.t)} IST · ${fmt(h.price)} (${h.price >= prevClose ? '▲' : '▼'} ${fmt(Math.abs(h.price - prevClose))})`
          : 'Tap or drag on the chart to read a price'}
      </Text>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        accessibilityLabel={`Intraday chart. Last ${fmt(last)}, previous close ${fmt(prevClose)}`}
      >
        <Svg width={width} height={height}>
          {!!prevClose && (
            <Line x1={0} x2={width} y1={y(prevClose)} y2={y(prevClose)} stroke={C.muted} strokeWidth={1} strokeDasharray="4 4" />
          )}
          <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {h && (
            <>
              <Line x1={x(h.t)} x2={x(h.t)} y1={0} y2={height} stroke={C.muted} strokeWidth={1} />
              <Rect x={x(h.t) - 4} y={y(h.price) - 4} width={8} height={8} rx={4} fill={color} stroke={C.card} strokeWidth={2} />
            </>
          )}
        </Svg>
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axis}>{hm(t0)}</Text>
        <Text style={styles.axis}>- - prev close {fmt(prevClose)}</Text>
        <Text style={styles.axis}>{hm(t1)}</Text>
      </View>
    </View>
  );
}

// ---------- 7-day mood (diverging bars) ----------

interface MoodProps {
  days: DayMood[];
  width: number;
  height?: number;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Bullish count above the baseline, bearish below, one column per day. Tap a day to read it. */
export function MoodTrendChart({ days, width, height = 120 }: MoodProps) {
  const [sel, setSel] = useState<number | null>(null);
  if (width <= 0) return null;
  const maxV = Math.max(1, ...days.map((d) => Math.max(d.up, d.down)));
  const half = height / 2;
  const col = width / days.length;
  const barW = Math.max(2, Math.min(18, col - 8));
  const s = sel != null ? days[sel] : null;

  return (
    <View>
      <Text style={styles.readout}>
        {s ? `${DAY[new Date(s.date + 'T00:00:00Z').getUTCDay()]} ${s.date.slice(8)}/${s.date.slice(5, 7)}: ▲ ${s.up} bullish · ▼ ${s.down} bearish` : 'Tap a day to see its counts'}
      </Text>
      <Svg width={width} height={height}>
        <Line x1={0} x2={width} y1={half} y2={half} stroke={C.grid} strokeWidth={1} />
        {days.map((d, i) => {
          const cx = col * i + col / 2;
          const hu = (d.up / maxV) * (half - 4);
          const hd = (d.down / maxV) * (half - 4);
          return (
            <G key={d.date}>
              {/* 1px gap either side of the baseline keeps the two arms visually separate */}
              {hu > 0 && <Rect x={cx - barW / 2} y={half - 1 - hu} width={barW} height={hu} rx={4} fill={C.upMark} opacity={sel == null || sel === i ? 1 : 0.4} />}
              {hd > 0 && <Rect x={cx - barW / 2} y={half + 1} width={barW} height={hd} rx={4} fill={C.downMark} opacity={sel == null || sel === i ? 1 : 0.4} />}
            </G>
          );
        })}
      </Svg>
      <View style={[styles.hitRow, { height }]}>
        {days.map((d, i) => (
          <Pressable key={d.date} style={styles.hit} onPress={() => setSel(sel === i ? null : i)} accessibilityLabel={`${d.date}: ${d.up} bullish, ${d.down} bearish`} />
        ))}
      </View>
      <View style={styles.axisRow}>
        {days.map((d) => (
          <Text key={d.date} style={[styles.axis, { width: col, textAlign: 'center' }]}>
            {DAY[new Date(d.date + 'T00:00:00Z').getUTCDay()]}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: C.upMark }]} />
        <Text style={styles.legendText}>▲ Bullish</Text>
        <View style={[styles.swatch, { backgroundColor: C.downMark }]} />
        <Text style={styles.legendText}>▼ Bearish</Text>
      </View>
    </View>
  );
}

// ---------- Small horizontal bar (sector rows, OI columns) ----------

/** A thin bar whose length is value/max of the available width. `align` = which side it grows from. */
export function Bar({ value, max, color, align = 'left' }: { value: number; max: number; color: string; align?: 'left' | 'right' }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={[styles.barTrack, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {pct > 0 && <View style={[styles.barFill, { width: `${Math.max(pct * 100, 3)}%`, backgroundColor: color }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hitRow: { position: 'absolute', left: 0, right: 0, top: 23, flexDirection: 'row' },
  hit: { flex: 1 },
  empty: { color: C.muted, fontSize: 12, paddingVertical: 24, textAlign: 'center' },
  readout: { color: C.muted, fontSize: 12, marginBottom: 6 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axis: { color: C.faint, fontSize: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: C.muted, fontSize: 11, marginRight: 10 },
  barTrack: { height: 6, flex: 1, justifyContent: 'center' },
  barFill: { height: 6, borderRadius: 3 },
});
