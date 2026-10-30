import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { NewsItem } from '../feed';
import { SOURCE_BY_ID, SOURCES } from '../sources';
import { C } from '../theme';

const ROW = 25;
const DAY_MS = 24 * 3600 * 1000;
const FRAME_MS = 33;
/** Fraction of a route a pulse travels per second */
const SPEED = 0.28;

interface Pt {
  x: number;
  y: number;
}

/** A horizontal S-curve between two points, as four bezier control points. */
const curve = (a: Pt, b: Pt): [Pt, Pt, Pt, Pt] => {
  const mx = (a.x + b.x) / 2;
  return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
};
const toPath = ([a, c1, c2, b]: [Pt, Pt, Pt, Pt]) => `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
const at = ([a, c1, c2, b]: [Pt, Pt, Pt, Pt], t: number): Pt => {
  const u = 1 - t;
  const k = (p: 'x' | 'y') => u * u * u * a[p] + 3 * u * u * t * c1[p] + 3 * u * t * t * c2[p] + t * t * t * b[p];
  return { x: k('x'), y: k('y') };
};

interface Props {
  items: NewsItem[];
  enabled: string[];
  now: number;
  width: number;
}

/**
 * Official sources routed through TradeWire into bullish / bearish / neutral.
 * Line weight and counts are real (last 24h); the moving pulses only mark which routes are active.
 */
export default function SignalMap({ items, enabled, now, width }: Props) {
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);

  // Animate only while this tab is on screen
  useFocusEffect(
    useCallback(() => {
      if (still) return;
      const start = Date.now();
      const timer = setInterval(() => setTick((Date.now() - start) / 1000), FRAME_MS);
      return () => clearInterval(timer);
    }, [still]),
  );

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of SOURCES) if (s.official && enabled.includes(s.id)) counts.set(s.short, counts.get(s.short) ?? 0);
    let up = 0;
    let down = 0;
    let flat = 0;
    for (const i of items) {
      if (now - i.time > DAY_MS || !enabled.includes(i.sourceId)) continue;
      const short = SOURCE_BY_ID[i.sourceId].short;
      if (counts.has(short)) counts.set(short, (counts.get(short) ?? 0) + 1);
      if (i.impact.tone.dir > 0) up++;
      else if (i.impact.tone.dir < 0) down++;
      else flat++;
    }
    return { sources: [...counts.entries()], up, down, flat };
  }, [items, enabled, now]);

  if (width <= 0) return null;
  const height = Math.max(stats.sources.length, 4) * ROW + 8;
  const cy = height / 2;
  const hubW = 92;
  const hubH = 46;
  const hubX = width * 0.46 - hubW / 2;
  const leftX = 62;
  const outX = width - 92;

  const inRoutes = stats.sources.map(([short, n], i) => ({
    short,
    n,
    y: ROW * i + ROW / 2 + 4,
    route: curve({ x: leftX, y: ROW * i + ROW / 2 + 4 }, { x: hubX, y: cy }),
  }));
  const outs = [
    { label: '▲ Bullish', n: stats.up, color: C.upMark, y: height * 0.2 },
    { label: '◆ Neutral', n: stats.flat, color: C.muted, y: height * 0.5 },
    { label: '▼ Bearish', n: stats.down, color: C.downMark, y: height * 0.8 },
  ].map((o) => ({ ...o, route: curve({ x: hubX + hubW, y: cy }, { x: outX, y: o.y }) }));

  const pulse = (seed: number) => (tick * SPEED + seed) % 1;

  return (
    <View accessibilityLabel={`Signal map: last 24 hours, ${stats.up} bullish, ${stats.down} bearish, ${stats.flat} neutral`}>
      <Svg width={width} height={height}>
        {inRoutes.map((r) => (
          <Path key={r.short} d={toPath(r.route)} stroke={r.n ? C.accent : C.grid} strokeOpacity={r.n ? 0.55 : 1} strokeWidth={r.n ? 1.4 : 1} fill="none" />
        ))}
        {outs.map((o) => (
          <Path key={o.label} d={toPath(o.route)} stroke={o.n ? o.color : C.grid} strokeOpacity={0.7} strokeWidth={1.4} fill="none" />
        ))}

        {inRoutes.map((r, i) => {
          if (!r.n || still) return null;
          const p = at(r.route, pulse(i * 0.17));
          return <Circle key={r.short} cx={p.x} cy={p.y} r={2.5} fill={C.accent} />;
        })}
        {outs.map((o, i) => {
          if (!o.n || still) return null;
          const p = at(o.route, pulse(i * 0.33));
          return <Circle key={o.label} cx={p.x} cy={p.y} r={3} fill={o.color} />;
        })}

        {inRoutes.map((r) => (
          <SvgText key={r.short} x={leftX - 6} y={r.y + 4} fontSize={11} fontWeight="600" fill={r.n ? C.text : C.faint} textAnchor="end">
            {`${r.short} ${r.n}`}
          </SvgText>
        ))}

        <Rect x={hubX - 6} y={cy - hubH / 2 - 6} width={hubW + 12} height={hubH + 12} rx={18} fill={C.accent} fillOpacity={0.1} />
        <Rect x={hubX} y={cy - hubH / 2} width={hubW} height={hubH} rx={13} fill={C.bg} stroke={C.accent} strokeWidth={1.2} />
        <SvgText x={hubX + hubW / 2} y={cy + 4} fontSize={12} fontWeight="700" fill={C.text} textAnchor="middle">
          TradeWire
        </SvgText>

        {outs.map((o) => (
          <SvgText key={o.label} x={outX + 6} y={o.y + 4} fontSize={11} fontWeight="600" fill={C.text}>
            {`${o.label} ${o.n}`}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.note}>Counts are official-source and media items from the last 24 hours. Pulses mark active routes, not single headlines.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
