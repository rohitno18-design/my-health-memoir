import { NativeBiometric } from "capacitor-native-biometric";

const BIOMETRIC_ENABLED_KEY = "imsmrti_biometric_enabled";

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
  } catch { return false; }
}

export function setBiometricEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
  } catch {}
}

export async function verifyBiometric(): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Authenticate to access your health records",
      title: "I M Smrti",
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkBiometricAvailability(): Promise<{
  available: boolean;
}> {
  try {
    const result = await NativeBiometric.isAvailable();
    return { available: result.isAvailable };
  } catch {
    return { available: false };
  }
}
