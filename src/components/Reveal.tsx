import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { riseStyle, useEntrance } from '../motion';

/** Fades and rises its children into place, after `delay` ms. */
export default function Reveal({ delay = 0, distance = 14, style, children }: { delay?: number; distance?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useEntrance(delay);
  return <Animated.View style={[style, riseStyle(v, distance)]}>{children}</Animated.View>;
}

/** Uncovers its children from left to right, so a chart appears to draw itself. */
export function Wipe({ width, delay = 150, duration = 1000, children }: { width: number; delay?: number; duration?: number; children: ReactNode }) {
  const v = useEntrance(delay, duration, false);
  return (
    <Animated.View style={{ overflow: 'hidden', width: v.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) }}>
      {children}
    </Animated.View>
  );
}
