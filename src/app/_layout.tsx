import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LockScreen from '../components/LockScreen';
import { StoreProvider, useStore } from '../store';
import { C } from '../theme';

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={[styles.icon, { opacity: focused ? 1 : 0.55 }]}>{glyph}</Text>;
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
              tabBarActiveTintColor: C.text,
              tabBarInactiveTintColor: C.muted,
              tabBarStyle: { backgroundColor: C.card, borderTopColor: C.cardBorder, ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : null) },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
              sceneStyle: { backgroundColor: C.bg },
            }}
          >
            <Tabs.Screen name="index" options={{ title: 'News', tabBarIcon: icon('📰') }} />
            <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('📊') }} />
            <Tabs.Screen name="options" options={{ title: 'Options', tabBarIcon: icon('📈') }} />
            <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('📅') }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙️') }} />
          </Tabs>
          <LockOverlay />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  icon: { fontSize: 20 },
});
