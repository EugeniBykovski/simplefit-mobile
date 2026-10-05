import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Non-sensitive, device-local user preferences (AsyncStorage: unencrypted).
 * Never store secrets, tokens or personal data here: use ./secure-storage.
 *
 * Every preference is declared here, with its storage key, so the full set of
 * persisted device state is visible in one place.
 */
const KEYS = {
  /** Explicitly selected UI locale; absent means "follow the device". */
  locale: "simplefit.preferences.locale",
  /** "dark" | "light" | "system"; absent means the default (dark). */
  theme: "simplefit.preferences.theme",
} as const;

export type PreferenceName = keyof typeof KEYS;

export async function getPreference(name: PreferenceName): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS[name]);
  } catch (error) {
    console.warn(`Could not read preference "${name}"`, error);
    return null;
  }
}

export async function setPreference(name: PreferenceName, value: string | null): Promise<void> {
  if (value === null) await AsyncStorage.removeItem(KEYS[name]);
  else await AsyncStorage.setItem(KEYS[name], value);
}
