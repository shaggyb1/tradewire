import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLayout } from '../layout';
import { riseStyle, useEntrance, useReducedMotion } from '../motion';
import { C } from '../theme';

const WAVE_H = 150;
const FRAME_MS = 40;
/** The orbs reach past the edge. In a browser, 'hidden' can still be scrolled sideways; 'clip' can't. */
const CLIP = (Platform.OS === 'web' ? 'clip' : 'hidden') as 'hidden';

/** Slow market-like lines drifting behind the headline. Purely decorative, not real prices. */
function SignalWave() {
  const { contentWidth: width } = useLayout();
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (reduced) return;
      const start = Date.now();
      const timer = setInterval(() => setT((Date.now() - start) / 1000), FRAME_MS);
      return () => clearInterval(timer);
    }, [reduced]),
  );

  if (width <= 0) return null;
  const line = (speed: number, amp: number, freq: number, base: number) => {
    let d = '';
    for (let x = 0; x <= width + 14; x += 14) {
      const y = base + Math.sin(x / freq + t * speed) * amp + Math.sin(x / (freq * 0.37) - t * speed * 1.6) * amp * 0.28;
      d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
    }
    return d;
  };

  return (
    <View pointerEvents="none" style={styles.wave} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={width} height={WAVE_H}>
        <Path d={line(0.5, 22, 150, 70)} stroke={C.accent} strokeOpacity={0.3} strokeWidth={1.5} fill="none" />
        <Path d={line(0.32, 34, 230, 78)} stroke={C.upMark} strokeOpacity={0.2} strokeWidth={1.5} fill="none" />
        <Path d={line(0.22, 44, 310, 86)} stroke={C.accent} strokeOpacity={0.12} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
}

const ORBS = [
  { color: '#8FC1D8', size: 460, left: '-6%', top: -190, dx: 90, dy: 40, ms: 13000 },
  { color: '#8FE0CF', size: 400, left: '46%', top: -170, dx: -110, dy: 60, ms: 17000 },
  { color: '#B9CFF0', size: 340, left: '78%', top: -60, dx: -70, dy: -40, ms: 21000 },
] as const;

function Orb({ orb }: { orb: (typeof ORBS)[number] }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(Animated.timing(v, { toValue: 1, duration: orb.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: false }));
    anim.start();
    return () => anim.stop();
  }, [v, orb.ms, reduced]);
  const swing = (d: number) => v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, d, 0] });
  return (
    <Animated.View
      style={
        [
          { position: 'absolute', left: orb.left, top: orb.top, width: orb.size, height: orb.size, borderRadius: orb.size / 2, backgroundColor: orb.color, opacity: 0.42, filter: 'blur(70px)' },
          { transform: [{ translateX: swing(orb.dx) }, { translateY: swing(orb.dy) }] },
        ] as never
      }
    />
  );
}

/** Soft coloured light drifting behind the page header. Browser only: phones can't blur this cheaply. */
export function Aurora() {
  if (Platform.OS !== 'web') return null;
  return (
    <View pointerEvents="none" style={styles.aurora}>
      {ORBS.map((o) => (
        <Orb key={o.color} orb={o} />
      ))}
    </View>
  );
}

/** The highlighter lands on the words a moment after the headline appears. */
function Highlight({ children }: { children: string }) {
  const v = useEntrance(760, 520, false);
  return (
    <Animated.Text
      style={{
        backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(58,112,137,0)', 'rgba(58,112,137,1)'] }),
        color: v.interpolate({ inputRange: [0, 1], outputRange: [C.text, C.accentInk] }),
      }}
    >
      {children}
    </Animated.Text>
  );
}

/** A slowly breathing dot marking that the data is live. */
export function PulseDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [v, reduced]);
  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />;
}

function Word({ delay, big, huge, children }: { delay: number; big: boolean; huge: boolean; children: ReactNode }) {
  const v = useEntrance(delay, 560);
  return <Animated.Text style={[styles.title, big && styles.titleBig, huge && styles.titleHuge, riseStyle(v, 26)]}>{children}</Animated.Text>;
}

export default function Hero({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  const { wide, compact, contentWidth } = useLayout();
  const a = useEntrance(0);
  const c = useEntrance(620);
  const d = useEntrance(460, 620);
  const big = contentWidth >= 700;
  const huge = contentWidth >= 1250;
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Aurora />
      <SignalWave />
      <View style={[styles.inner, wide && styles.innerWide]}>
        <View style={wide ? styles.copyWide : undefined}>
          {/* On a phone the first screen belongs to the news */}
          {!compact && (
            <>
              <Animated.Text style={[styles.eyebrow, riseStyle(a)]}>Official sources · India & global</Animated.Text>
              <View style={styles.words}>
                <Word delay={60} big={big} huge={huge}>Market</Word>
                <Word delay={180} big={big} huge={huge}>news,</Word>
                <Word delay={300} big={big} huge={huge}>
                  <Highlight> from the source. </Highlight>
                </Word>
              </View>
            </>
          )}
          <Animated.View style={[styles.status, riseStyle(c)]}>{children}</Animated.View>
        </View>
        {!!aside && <Animated.View style={[wide ? styles.asideWide : styles.aside, riseStyle(d, 22)]}>{aside}</Animated.View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 14, paddingBottom: 16, overflow: CLIP },
  heroCompact: { paddingTop: 2, paddingBottom: 0 },
  inner: { paddingHorizontal: 16, gap: 8 },
  innerWide: { flexDirection: 'row', alignItems: 'center', gap: 28, paddingHorizontal: 24, paddingVertical: 22 },
  copyWide: { flex: 1.15 },
  aside: { marginHorizontal: -12 },
  asideWide: { flex: 1 },
  wave: { position: 'absolute', left: 0, right: 0, top: 30 },
  aurora: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: CLIP },
  eyebrow: { color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, marginBottom: 8 },
  title: { color: C.text, fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  titleBig: { fontSize: 58, lineHeight: 68, letterSpacing: -2.2 },
  titleHuge: { fontSize: 76, lineHeight: 88, letterSpacing: -3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
