import { defaultLocale, matchLocale, type Locale } from "./locales";

/** A device locale as reported by expo-localization (subset we rely on). */
export type DeviceLocale = { languageTag: string; languageCode: string | null };

/**
 * Picks the app locale from the device's preferred languages, in order:
 * the first exact supported tag ("es-MX"), else the first supported base
 * language ("es-AR" -> "es", "de-AT" -> "de"), else English.
 *
 * Language only: region, country, time zone and currency are never inferred
 * from it, and geolocation is never used.
 */
export function resolveDeviceLocale(deviceLocales: readonly DeviceLocale[]): Locale {
  for (const device of deviceLocales) {
    const exact = matchLocale(device.languageTag);
    if (exact) return exact;
  }
  for (const device of deviceLocales) {
    const base = matchLocale(device.languageCode ?? device.languageTag.split("-")[0]);
    if (base) return base;
  }
  return defaultLocale;
}

/**
 * The active locale: an explicit in-app choice always overrides the device.
 * A stored value that is no longer supported is ignored (falls back to device).
 */
export function resolveActiveLocale(
  stored: string | null,
  deviceLocales: readonly DeviceLocale[],
): { locale: Locale; source: "explicit" | "device" } {
  const explicit = matchLocale(stored);
  if (explicit) return { locale: explicit, source: "explicit" };
  return { locale: resolveDeviceLocale(deviceLocales), source: "device" };
}
