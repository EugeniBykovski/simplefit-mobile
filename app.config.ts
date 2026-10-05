import type { ConfigContext, ExpoConfig } from "expo/config";

import localeRegistry from "./src/shared/i18n/locales.json";

// Same registry the app uses (src/shared/i18n/locales.ts).
const locales = Object.keys(localeRegistry);

/**
 * Expo app configuration. Identity values are permanent once published:
 * - bundle ID / package `com.simplefit.boxing` (chosen in SF-12),
 * - URL scheme `simplefit` (deep links: simplefit://app).
 * EAS project ID, Apple team and signing credentials are added by `eas init`
 * / `eas credentials` when the EAS project is created (not in source).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SimpleFit Boxing",
  slug: "simplefit-boxing",
  scheme: "simplefit",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android"],
  ios: {
    bundleIdentifier: "com.simplefit.boxing",
    supportsTablet: true,
  },
  android: {
    package: "com.simplefit.boxing",
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      // Neutral placeholders until SF-13 delivers brand assets.
      { backgroundColor: "#ffffff", dark: { backgroundColor: "#0a0a0a" } },
    ],
    [
      // Registers supported languages with the OS (per-app language settings).
      "expo-localization",
      { supportedLocales: { ios: locales, android: locales } },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
