import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalendarIcon, InsightsIcon, NewsIcon, OptionsIcon, SettingsIcon } from '../components/Icons';
import LockScreen from '../components/LockScreen';
import { StoreProvider, useStore } from '../store';
import { C } from '../theme';

// Each tab needs an opaque background, or inactive tabs show through. On web it also carries the glow.
const SCENE = {
  backgroundColor: C.bg,
  ...(Platform.OS === 'web'
    ? { backgroundImage: 'radial-gradient(60rem 28rem at 15% -8%, rgba(229,172,130,0.13), transparent 70%), radial-gradient(50rem 26rem at 95% 0%, rgba(158,203,187,0.07), transparent 70%)' }
    : null),
};

function LockOverlay() {
  const { locked, unlock } = useStore();
  return locked ? <LockScreen onUnlock={unlock} /> : null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <View style={styles.root}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: C.accent,
              tabBarInactiveTintColor: C.muted,
              tabBarStyle: { backgroundColor: C.card, borderTopColor: C.cardBorder, ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : null) },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
              sceneStyle: SCENE,
            }}
          >
            <Tabs.Screen name="index" options={{ title: 'News', tabBarIcon: NewsIcon }} />
            <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: InsightsIcon }} />
            <Tabs.Screen name="options" options={{ title: 'Options', tabBarIcon: OptionsIcon }} />
            <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: CalendarIcon }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: SettingsIcon }} />
          </Tabs>
          <LockOverlay />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? 'transparent' : C.bg },
});
