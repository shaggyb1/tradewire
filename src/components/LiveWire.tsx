import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { linkLabel, type NewsItem } from '../feed';
import { useLayout } from '../layout';
import { useReducedMotion } from '../motion';
import { SOURCE_BY_ID } from '../sources';
import { openLink } from '../store';
import { C } from '../theme';

const TYPE_MS = 24;
const TICK_MS = TYPE_MS * 2;
const HOLD_MS = 5000;
const STORY_COUNT = 6;
const WINDOW_MS = 24 * 3600 * 1000;

/** A card that types out the most important real headlines of the last 24 hours. Tap one to open it. */
export default function LiveWire({ items, now, enabled }: { items: NewsItem[]; now: number; enabled: string[] }) {
  const reduced = useReducedMotion();
  const { compact } = useLayout();
  const stories = useMemo(
    () =>
      items
        .filter((i) => enabled.includes(i.sourceId) && now - i.time < WINDOW_MS && (i.impact.level >= 2 || i.impact.tone.dir !== 0))
        .sort((a, b) => b.impact.level - a.impact.level || b.time - a.time)
        .slice(0, STORY_COUNT),
    [items, now, enabled],
  );

  // Follow the story, not its position, so a refresh doesn't swap the headline being read
  const [storyId, setStoryId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const found = stories.findIndex((s) => s.id === storyId);
  const index = Math.max(found, 0);
  const paused = useRef(false);
  const state = useRef({ stories, index, reduced });
  useEffect(() => {
    state.current = { stories, index, reduced };
  });

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        const { stories: list, index: at, reduced: still } = state.current;
        if (paused.current || still || !list.length) return;
        setElapsed((e) => {
          if (e + TICK_MS < list[at].title.length * TYPE_MS + HOLD_MS) return e + TICK_MS;
          setStoryId(list[(at + 1) % list.length].id);
          return 0;
        });
      }, TICK_MS);
      return () => clearInterval(timer);
    }, []),
  );

  if (!stories.length) return null;

  const story = stories[index];
  const typed = reduced ? story.title : story.title.slice(0, Math.floor(elapsed / TYPE_MS));
  const done = typed.length >= story.title.length;
  const tone = story.impact.tone;
  const detail = story.summary.replace(/\s*\|\s*/g, ' · ');

  // Show the chosen headline in full and give it the whole reading time
  const go = (step: number) => {
    const next = stories[(index + step + stories.length) % stories.length];
    setStoryId(next.id);
    setElapsed(next.title.length * TYPE_MS);
  };

  return (
    <View style={styles.card}>
      <View style={styles.bar}>
        <Text style={styles.path}>Top signals · 24h</Text>
        <View style={styles.nav}>
          <Pressable onPress={() => go(-1)} hitSlop={8} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Previous headline">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.count}>
            {index + 1}/{stories.length}
          </Text>
          <Pressable onPress={() => go(1)} hitSlop={8} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Next headline">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => openLink(story.link)}
        onHoverIn={() => (paused.current = true)}
        onHoverOut={() => (paused.current = false)}
        style={[styles.body, compact && styles.bodyCompact]}
        accessibilityRole="link"
        accessibilityLabel={`Top headline: ${story.title}`}
      >
        <Text style={styles.prompt} numberOfLines={1}>
          {SOURCE_BY_ID[story.sourceId].name}
          {linkLabel(story.link) ? ` · ${linkLabel(story.link)}` : ''}
        </Text>
        {/* Fixed heights so the page doesn't move as headlines change */}
        <Text style={styles.line} numberOfLines={2}>
          {typed}
          {!done && <Text style={{ color: C.accent }}>▌</Text>}
        </Text>
        <Text style={[styles.detail, compact && styles.detailCompact, { opacity: done ? 1 : 0 }]} numberOfLines={compact ? 1 : 2}>
          {detail}
        </Text>
        <Text style={[styles.result, { color: tone.dir > 0 ? C.bull : tone.dir < 0 ? C.bear : C.muted, opacity: done ? 1 : 0 }]} numberOfLines={1}>
          {tone.dir > 0 ? '▲ Bullish' : tone.dir < 0 ? '▼ Bearish' : '◆ No clear direction'}
          {tone.reasons[0] ? ` · ${tone.reasons[0]}` : story.impact.tags[0] ? ` · ${story.impact.tags[0]}` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginBottom: 10, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.cardBorder, backgroundColor: C.card },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  arrowText: { color: C.accent, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  path: { color: C.muted, fontSize: 12, fontWeight: '600' },
  count: { color: C.muted, fontSize: 11, minWidth: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  body: { padding: 14, gap: 6 },
  prompt: { color: C.accent, fontSize: 12, fontWeight: '600' },
  line: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 21, height: 42 },
  detail: { color: C.muted, fontSize: 12, lineHeight: 17, height: 34 },
  detailCompact: { height: 17 },
  bodyCompact: { paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  result: { fontSize: 12, fontWeight: '700' },
});
