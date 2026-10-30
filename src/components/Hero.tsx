import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { riseStyle, useEntrance, useReducedMotion } from '../motion';
import { C, MAX_WIDTH } from '../theme';

const WAVE_H = 120;
const FRAME_MS = 40;

/** A slow market-like line drifting behind the headline. Purely decorative, not real prices. */
function SignalWave() {
  const width = Math.min(useWindowDimensions().width, MAX_WIDTH);
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
    for (let x = 0; x <= width; x += 14) {
      const y = base + Math.sin(x / freq + t * speed) * amp + Math.sin(x / (freq * 0.37) - t * speed * 1.6) * amp * 0.28;
      d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
    }
    return d;
  };

  return (
    <View pointerEvents="none" style={styles.wave} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={width} height={WAVE_H}>
        <Path d={line(0.5, 20, 130, 58)} stroke={C.accent} strokeOpacity={0.22} strokeWidth={1.5} fill="none" />
        <Path d={line(0.32, 30, 190, 66)} stroke={C.open} strokeOpacity={0.12} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

/** The highlighter lands on the words a moment after the headline appears. */
function Highlight({ children }: { children: string }) {
  const v = useEntrance(520, 480, false);
  return (
    <Animated.Text
      style={{
        backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(212,206,140,0)', 'rgba(212,206,140,1)'] }),
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

export default function Hero({ wide, children }: { wide: boolean; children: ReactNode }) {
  const a = useEntrance(0);
  const b = useEntrance(120);
  const c = useEntrance(320);
  return (
    <View style={styles.hero}>
      <SignalWave />
      <Animated.Text style={[styles.eyebrow, riseStyle(a)]}>Official sources · India & global</Animated.Text>
      <Animated.Text style={[styles.title, wide && styles.titleWide, riseStyle(b, 18)]}>
        Market news, <Highlight> from the source. </Highlight>
      </Animated.Text>
      <Animated.View style={[styles.status, riseStyle(c)]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 8, overflow: 'hidden' },
  wave: { position: 'absolute', left: 0, right: 0, top: 18 },
  eyebrow: { color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { color: C.text, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.2 },
  titleWide: { fontSize: 60, lineHeight: 68, letterSpacing: -2.4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
