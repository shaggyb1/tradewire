import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

interface Props {
  onUnlock: () => void;
}

/** Full-screen cover shown while the app is locked. Prompts automatically once. */
export default function LockScreen({ onUnlock }: Props) {
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    onUnlock();
  }, [onUnlock]);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>TradeWire is locked</Text>
      <Text style={styles.sub}>Use your fingerprint, face or phone PIN to continue.</Text>
      <Pressable onPress={onUnlock} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>
        <Text style={styles.btnText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    zIndex: 100,
  },
  icon: { fontSize: 48 },
  title: { color: C.text, fontSize: 20, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 14, textAlign: 'center' },
  btn: { marginTop: 16, backgroundColor: C.accent, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: C.accentInk, fontSize: 16, fontWeight: '700' },
});
