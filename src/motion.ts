import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/** The native driver isn't available on web */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** True when the user has asked their device for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/** 0 → 1 once, after `delay` ms. For fade-and-rise entrances. */
export function useEntrance(delay = 0, duration = 420, useNativeDriver = NATIVE_DRIVER): Animated.Value {
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration, useNativeDriver, reduced]);
  return v;
}

/** Style for fading in while rising a few pixels. */
export const riseStyle = (v: Animated.Value, distance = 12) => ({
  opacity: v,
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
});

/** Counts smoothly to `target`, so changing numbers tick over instead of jumping. */
export function useCountUp(target: number, duration = 700): number {
  const [shown, setShown] = useState(0);
  const last = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setShown(target), 0);
      return () => clearTimeout(t);
    }
    const from = last.current;
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / duration);
      last.current = Math.round(from + (target - from) * (1 - (1 - p) ** 3));
      setShown(last.current);
      if (p === 1) clearInterval(timer);
    }, 33);
    return () => clearInterval(timer);
  }, [target, duration, reduced]);
  return shown;
}
