import * as LocalAuthentication from 'expo-local-authentication';

/** True if the phone has a fingerprint/face or at least a PIN/pattern/password set up. */
export async function canLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the system fingerprint / face / PIN prompt. Resolves true on success. */
export async function authenticate(message = 'Unlock TradeWire'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Cancel',
      // Allow the phone's PIN / pattern if fingerprint fails or isn't set up
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}
