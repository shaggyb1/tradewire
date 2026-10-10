import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NewsItem } from '../feed';
import { SOURCE_BY_ID } from '../sources';
import { C, LEVEL_COLOR, LEVEL_LABEL } from '../theme';
import { itemTime } from '../time';

interface Props {
  item: NewsItem;
  now: number;
  isNew: boolean;
  /** Watchlist term this item matches, if any */
  watched: string | null;
  onOpen: (item: NewsItem) => void;
  onShare: (item: NewsItem) => void;
}

function NewsCard({ item, now, isNew, watched, onOpen, onShare }: Props) {
  const src = SOURCE_BY_ID[item.sourceId];
  const { level, tags, sectors, tone } = item.impact;
  const showTone = tone.dir !== 0 || tone.mixed;
  const toneColor = tone.dir > 0 ? C.bull : tone.dir < 0 ? C.bear : C.muted;
  const toneLabel =
    tone.dir > 0 ? `▲ ${tone.strength === 2 ? 'Strongly ' : ''}Bullish` : tone.dir < 0 ? `▼ ${tone.strength === 2 ? 'Strongly ' : ''}Bearish` : '◆ Mixed signals';
  return (
    <Pressable
      onPress={() => onOpen(item)}
      onLongPress={() => onShare(item)}
      style={({ pressed }) => [styles.card, !!watched && styles.cardWatched, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
    >
      <View style={[styles.bar, { backgroundColor: LEVEL_COLOR[level] }]} />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={[styles.badge, !src.official && styles.badgeMedia]}>{src.short}</Text>
          {!src.official && <Text style={styles.mediaTag}>MEDIA</Text>}
          {!!watched && <Text style={styles.watchTag}>★ {watched}</Text>}
          {isNew && <Text style={styles.newTag}>NEW</Text>}
          {level > 0 && (
            <Text style={[styles.level, { color: LEVEL_COLOR[level] }]}>● {LEVEL_LABEL[level]}</Text>
          )}
          <Text style={styles.time} numberOfLines={1}>
            {itemTime(item, now)}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        {!!item.summary && (
          <Text style={styles.summary} numberOfLines={3}>
            {item.summary}
          </Text>
        )}

        {showTone && (
          <View
            style={[styles.tone, { backgroundColor: tone.dir > 0 ? C.bullBg : tone.dir < 0 ? C.bearBg : C.mixedBg }]}
            accessibilityLabel={`News tone: ${toneLabel}. ${tone.reasons.join('. ')}`}
          >
            <Text style={[styles.toneLabel, { color: toneColor }]}>
              {toneLabel}
              {tone.mixed && tone.dir !== 0 ? ' (mixed)' : ''}
            </Text>
            {tone.reasons.map((r) => (
              <Text key={r} style={styles.toneWhy}>
                {r}
              </Text>
            ))}
          </View>
        )}

        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <Text key={t} style={styles.tag}>
                {t}
              </Text>
            ))}
          </View>
        )}
        {sectors.length > 0 && <Text style={styles.sectors}>Sensitive: {sectors.join(' · ')}</Text>}
      </View>
    </Pressable>
  );
}

export default memo(NewsCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardWatched: { borderColor: C.accent, borderWidth: 1 },
  watchTag: { color: C.accent, fontSize: 11, fontWeight: '800', flexShrink: 1 },
  bar: { width: 4 },
  body: { flex: 1, padding: 12, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    color: C.text,
    backgroundColor: C.chipActive,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeMedia: { backgroundColor: C.none },
  mediaTag: { color: C.faint, fontSize: 10, fontWeight: '700' },
  newTag: { color: C.bg, backgroundColor: C.open, fontSize: 10, fontWeight: '800', paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden' },
  level: { fontSize: 11, fontWeight: '700' },
  time: { color: C.muted, fontSize: 11, marginLeft: 'auto', flexShrink: 1 },
  title: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  summary: { color: C.muted, fontSize: 13, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    color: C.accent,
    borderColor: C.chipActive,
    borderWidth: 1,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  sectors: { color: C.faint, fontSize: 11 },
  tone: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
  toneLabel: { fontSize: 13, fontWeight: '800' },
  toneWhy: { color: C.muted, fontSize: 12 },
});
