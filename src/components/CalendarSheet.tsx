import { useMemo } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dayLabel, HOLIDAYS_KNOWN_UNTIL, upcomingEvents, type CalEvent, type EventKind } from '../calendar';
import type { NewsItem } from '../feed';
import { C } from '../theme';

interface Props {
  visible: boolean;
  now: number;
  items: NewsItem[];
  watchlist: string[];
  onOpenLink: (url: string) => void;
  onClose: () => void;
}

const KIND_STYLE: Record<EventKind, { icon: string; color: string }> = {
  RBI: { icon: '🏦', color: C.high },
  Fed: { icon: '🇺🇸', color: C.high },
  Budget: { icon: '📜', color: C.high },
  Data: { icon: '📊', color: C.med },
  Results: { icon: '★', color: C.accent },
  Expiry: { icon: '⏳', color: C.muted },
  Holiday: { icon: '🚫', color: C.bear },
};

export default function CalendarSheet({ visible, now, items, watchlist, onOpenLink, onClose }: Props) {
  const sections = useMemo(() => {
    if (!visible) return [];
    const byDate = new Map<string, CalEvent[]>();
    for (const e of upcomingEvents(now, items, watchlist)) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()].map(([date, data]) => ({ title: dayLabel(date, now), data }));
  }, [visible, now, items, watchlist]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.h1}>Market calendar</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(e, i) => `${e.date}-${e.title}-${i}`}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.content}
          renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
          renderItem={({ item }) => {
            const k = KIND_STYLE[item.kind];
            return (
              <Pressable
                disabled={!item.link}
                onPress={() => item.link && onOpenLink(item.link)}
                style={[styles.event, item.weight === 3 && { borderLeftColor: k.color }]}
              >
                <Text style={styles.icon}>{k.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, item.weight === 1 && { color: C.muted, fontWeight: '500' }]}>{item.title}</Text>
                  {!!item.note && <Text style={styles.note}>{item.note}</Text>}
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Text style={styles.footer}>
              Sources: NSE holiday list, RBI MPC schedule, US Federal Reserve FOMC calendar, MoSPI release calendar.
              Dates can change; check the official site on the day. Holidays are loaded up to{' '}
              {HOLIDAYS_KNOWN_UNTIL.split('-').reverse().join('-')}.{'\n\n'}
              {watchlist.length
                ? '★ Results dates appear when NSE posts a board-meeting notice for a watchlist stock.'
                : 'Add stocks to your watchlist in Settings to see their results dates here.'}
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  h1: { color: C.text, fontSize: 22, fontWeight: '700' },
  done: { color: C.accent, fontSize: 16, fontWeight: '600' },
  content: { paddingHorizontal: 12, paddingBottom: 48 },
  day: { color: C.muted, backgroundColor: C.bg, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', paddingTop: 16, paddingBottom: 6, paddingHorizontal: 4 },
  event: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  icon: { fontSize: 18, width: 24, textAlign: 'center', color: C.accent },
  title: { color: C.text, fontSize: 14, fontWeight: '600' },
  note: { color: C.muted, fontSize: 12, marginTop: 2 },
  footer: { color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 20, paddingHorizontal: 4 },
});
