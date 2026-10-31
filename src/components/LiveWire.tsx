import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NewsItem } from '../feed';
import { useReducedMotion } from '../motion';
import { SOURCE_BY_ID } from '../sources';
import { openLink } from '../store';
import { C } from '../theme';

const TYPE_MS = 24;
const HOLD_MS = 3200;
const STORY_COUNT = 6;
const WINDOW_MS = 24 * 3600 * 1000;

/** A terminal that types out the most important real headlines of the last 24 hours. Tap to open one. */
export default function LiveWire({ items, now, enabled }: { items: NewsItem[]; now: number; enabled: string[] }) {
  const reduced = useReducedMotion();
  const stories = useMemo(
    () =>
      items
        .filter((i) => enabled.includes(i.sourceId) && now - i.time < WINDOW_MS && (i.impact.level >= 2 || i.impact.tone.dir !== 0))
        .sort((a, b) => b.impact.level - a.impact.level || b.time - a.time)
        .slice(0, STORY_COUNT),
    [items, now, enabled],
  );

  const [elapsed, setElapsed] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const start = Date.now();
      const timer = setInterval(() => setElapsed(Date.now() - start), TYPE_MS * 2);
      return () => clearInterval(timer);
    }, []),
  );

  if (!stories.length) return null;

  // Work out from the clock which story is showing and how much of it is typed
  const spans = stories.map((s) => s.title.length * TYPE_MS + HOLD_MS);
  const total = spans.reduce((a, b) => a + b, 0);
  let t = reduced ? 0 : elapsed % total;
  let index = 0;
  while (t >= spans[index]) {
    t -= spans[index];
    index++;
  }
  const story = stories[index];
  const typed = reduced ? story.title : story.title.slice(0, Math.floor(t / TYPE_MS));
  const done = typed.length >= story.title.length;
  const tone = story.impact.tone;

  return (
    <Pressable onPress={() => openLink(story.link)} style={styles.card} accessibilityRole="link" accessibilityLabel={`Top headline: ${story.title}`}>
      <View style={styles.bar}>
        <View style={styles.lights}>
          <View style={[styles.light, { backgroundColor: C.downMark }]} />
          <View style={[styles.light, { backgroundColor: C.med }]} />
          <View style={[styles.light, { backgroundColor: C.upMark }]} />
        </View>
        <Text style={styles.path}>tradewire / top signals</Text>
        <Text style={styles.count}>
          {index + 1}/{stories.length}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.prompt}>$ watch {SOURCE_BY_ID[story.sourceId].short.toLowerCase()}</Text>
        {/* Fixed height so the page doesn't move as headlines change */}
        <Text style={styles.line} numberOfLines={3}>
          {typed}
          {!done && <Text style={{ color: C.accent }}>▌</Text>}
        </Text>
        <Text style={[styles.result, { color: tone.dir > 0 ? C.bull : tone.dir < 0 ? C.bear : C.muted, opacity: done ? 1 : 0 }]} numberOfLines={1}>
          {tone.dir > 0 ? '▲ Bullish' : tone.dir < 0 ? '▼ Bearish' : '◆ Watch'}
          {tone.reasons[0] ? ` · ${tone.reasons[0]}` : story.impact.tags[0] ? ` · ${story.impact.tags[0]}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginBottom: 10, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.cardBorder, backgroundColor: C.card },
  lights: { flexDirection: 'row', gap: 5, width: 50 },
  light: { width: 8, height: 8, borderRadius: 4 },
  path: { color: C.muted, fontSize: 11 },
  count: { color: C.faint, fontSize: 11, width: 50, textAlign: 'right', fontVariant: ['tabular-nums'] },
  body: { padding: 14, gap: 6 },
  prompt: { color: C.accent, fontSize: 12, fontWeight: '600' },
  line: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 21, height: 63 },
  result: { fontSize: 12, fontWeight: '700' },
});
