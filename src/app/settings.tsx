import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SOURCES, type Source } from '../sources';
import type { Settings } from '../storage';
import { useStore } from '../store';
import { C, MAX_WIDTH } from '../theme';
import { normalizeTerm } from '../watchlist';

const IS_WEB = Platform.OS === 'web';
const INTERVALS = IS_WEB ? [120, 300] : [30, 60, 120, 300];

const ALERT_OPTIONS: { level: Settings['alertLevel']; label: string }[] = [
  { level: 0, label: 'Off' },
  { level: 3, label: 'High only' },
  { level: 2, label: 'Medium + High' },
];

const GROUPS: { title: string; filter: (s: Source) => boolean }[] = [
  { title: 'India — official', filter: (s) => s.official && s.region === 'India' },
  { title: 'Global — official', filter: (s) => s.official && s.region === 'Global' },
  { title: 'News media (not official, off by default)', filter: (s) => !s.official },
];

export default function SettingsScreen() {
  const { settings, errors, updateSettings: onChange, clearData: onClearData } = useStore();
  const toggle = (id: string, on: boolean) =>
    onChange({ ...settings, enabled: on ? [...settings.enabled, id] : settings.enabled.filter((x) => x !== id) });

  const [draft, setDraft] = useState('');
  const addTerm = () => {
    const term = normalizeTerm(draft);
    setDraft('');
    if (!term || settings.watchlist.some((t) => t.toLowerCase() === term.toLowerCase())) return;
    onChange({ ...settings, watchlist: [...settings.watchlist, term] });
  };

  const confirmClear = () => {
    if (IS_WEB) {
      if (window.confirm('Clear all data? Removes cached news and settings from this browser.')) onClearData();
      return;
    }
    Alert.alert('Clear all data?', 'Removes cached news and settings from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: onClearData },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.h1}>Settings</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.h2}>★ Watchlist</Text>
          <Text style={styles.p}>
            Stocks or topics you trade. Matching news is starred, gets its own tab, and their results dates show in the
            calendar. Use the name as companies write it, e.g. “Reliance”, “HDFC Bank”, “Tata Motors”, or topics like
            “crude”.
          </Text>
          <View style={[styles.row, { marginTop: 8 }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addTerm}
              placeholder="Add stock or topic"
              placeholderTextColor={C.faint}
              style={styles.input}
              autoCorrect={false}
              returnKeyType="done"
            />
            <Pressable onPress={addTerm} style={[styles.chip, styles.chipOn]}>
              <Text style={styles.chipText}>Add</Text>
            </Pressable>
          </View>
          <View style={[styles.row, { flexWrap: 'wrap', marginTop: 8 }]}>
            {settings.watchlist.map((t) => (
              <Pressable
                key={t}
                onPress={() => onChange({ ...settings, watchlist: settings.watchlist.filter((x) => x !== t) })}
                style={styles.chip}
                accessibilityLabel={`Remove ${t} from watchlist`}
              >
                <Text style={styles.chipText}>★ {t}  ✕</Text>
              </Pressable>
            ))}
            {!settings.watchlist.length && <Text style={styles.sub}>Nothing added yet.</Text>}
          </View>

          <Text style={styles.h2}>Auto-refresh</Text>
          <View style={styles.row}>
            {INTERVALS.map((s) => (
              <Pressable
                key={s}
                onPress={() => onChange({ ...settings, intervalSec: s })}
                style={[styles.chip, settings.intervalSec === s && styles.chipOn]}
              >
                <Text style={styles.chipText}>{s < 60 ? `${s}s` : `${s / 60}m`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Keep screen on (trading desk mode)</Text>
            <Switch value={settings.keepAwake} onValueChange={(v) => onChange({ ...settings, keepAwake: v })} />
          </View>

          {!IS_WEB && (
            <>
          <Text style={styles.h2}>Alerts when the app is closed</Text>
          <View style={styles.row}>
            {ALERT_OPTIONS.map((o) => (
              <Pressable
                key={o.level}
                onPress={() => onChange({ ...settings, alertLevel: o.level })}
                style={[styles.chip, settings.alertLevel === o.level && styles.chipOn]}
              >
                <Text style={styles.chipText}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Only alert for my watchlist</Text>
              <Text style={styles.sub}>Watchlist news always alerts (any impact) while alerts are on</Text>
            </View>
            <Switch
              value={settings.watchOnlyAlerts}
              onValueChange={(v) => onChange({ ...settings, watchOnlyAlerts: v })}
              disabled={settings.alertLevel === 0}
            />
          </View>
          <Text style={[styles.p, { marginTop: 8 }]}>
            The phone checks in the background about every 15 minutes at best. Android and iOS decide the exact timing
            and may check less often to save battery, so alerts are not instant. Keep the app open for live updates.
          </Text>
            </>
          )}

          {GROUPS.map((g) => (
            <View key={g.title}>
              <Text style={styles.h2}>{g.title}</Text>
              {SOURCES.filter(g.filter).map((s) => (
                <View key={s.id} style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{s.name}</Text>
                    <Text style={[styles.sub, errors[s.id] && { color: C.high }]}>
                      {errors[s.id] ? `Last fetch failed: ${errors[s.id]}` : s.url.replace(/^https:\/\//, '').split('/')[0]}
                    </Text>
                  </View>
                  <Switch value={settings.enabled.includes(s.id)} onValueChange={(v) => toggle(s.id, v)} />
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.h2}>Privacy</Text>
          {!IS_WEB && (
            <>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>App lock</Text>
              <Text style={styles.sub}>Fingerprint, face or phone PIN to open. Alerts hide headlines.</Text>
            </View>
            <Switch value={settings.lockEnabled} onValueChange={(v) => onChange({ ...settings, lockEnabled: v })} />
          </View>
          <View style={[styles.switchRow, { marginBottom: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Hide screen</Text>
              <Text style={styles.sub}>Blocks screenshots and blanks the app in recent apps</Text>
            </View>
            <Switch value={settings.hideScreen} onValueChange={(v) => onChange({ ...settings, hideScreen: v })} />
          </View>
            </>
          )}
          {IS_WEB && (
            <Text style={[styles.p, { marginBottom: 8 }]}>
              Website version: browsers can’t read these sites directly, so requests pass through this site’s server on
              Expo’s hosting, which can see your IP address and keeps logs for 7 days. For the most privacy, and for alerts
              and the app lock, use the phone app.
            </Text>
          )}
          <Text style={styles.p}>
            • No account, no login, no analytics, no ads, no tracking SDKs.{'\n'}
            • No middle server: your phone fetches each feed directly from the official website over HTTPS.{'\n'}
            • Requests use a generic phone-browser identity and send no cookies.{'\n'}
            • Cached news and settings stay only on this phone.{'\n'}
            • Tracking parameters are stripped from links.{'\n'}
            • The market tape and the Options and Insights tabs read market data from the nseindia.com website, only while you have
            them open. NSE sets its own cookies for this; nothing else is shared.{'\n\n'}
            Limits: the websites you fetch from (and your mobile network) can still see your IP address, like
            any browsing. To hide that too, run a trusted VPN or Orbot (Tor) on the phone.
          </Text>
          <Pressable onPress={confirmClear} style={styles.danger}>
            <Text style={styles.dangerText}>Clear all data on this phone</Text>
          </Pressable>

          <Text style={styles.h2}>Disclaimer</Text>
          <Text style={styles.p}>
            Impact levels, sensitive sectors and the Bullish / Bearish indicator are automatic keyword tags. They show
            how this kind of news has typically moved Indian markets, based only on the headline’s wording. They do not
            know prices, what is already priced in, or your situation, and they can be wrong.{'\n\n'}
            They are not investment advice or buy/sell signals. Always read the original source and do your own
            research, or consult a SEBI-registered adviser, before trading.
          </Text>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : C.bg },
  header: { padding: 16, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  h1: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  content: { paddingHorizontal: 16, paddingBottom: 48, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  h2: { color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: C.chip, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  chipOn: { backgroundColor: C.chipActive },
  chipText: { color: C.text, fontWeight: '600' },
  input: { flex: 1, backgroundColor: C.card, color: C.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: C.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  label: { color: C.text, fontSize: 15, flexShrink: 1 },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  p: { color: C.muted, fontSize: 13, lineHeight: 20 },
  danger: { marginTop: 16, padding: 12, borderRadius: 8, borderColor: C.high, borderWidth: 1, alignItems: 'center' },
  dangerText: { color: C.high, fontWeight: '600' },
});
