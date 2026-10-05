import * as SecureStore from "expo-secure-store";

/**
 * The ONLY place sensitive device-local data is persisted (Keychain on iOS,
 * Keystore-backed storage on Android). Future consumers: auth access/refresh
 * tokens, device credentials.
 *
 * SecureStore is not a general database: values are small strings (keep them
 * well under 2 KB), reads are slow-ish, and there is no querying. Everything
 * non-sensitive belongs in ./preferences.
 *
 * Items are readable only while the device is unlocked and never migrate to
 * another device through backups.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** SecureStore accepts only alphanumerics, ".", "-" and "_" in keys. */
const KEY_PATTERN = /^[\w.-]+$/;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Invalid secure storage key "${key}": use letters, digits, ".", "-" or "_".`);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  assertKey(key);
  return SecureStore.getItemAsync(key, OPTIONS);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  assertKey(key);
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function deleteSecureItem(key: string): Promise<void> {
  assertKey(key);
  await SecureStore.deleteItemAsync(key, OPTIONS);
}
