import type { ConfigContext, ExpoConfig } from "expo/config";

import localeRegistry from "./src/shared/i18n/locales.json";

// Same registry the app uses (src/shared/i18n/locales.ts).
const locales = Object.keys(localeRegistry);

/**
 * Expo app configuration. Identity values are permanent once published:
 * - bundle ID / package `com.simplefit.boxing` (chosen in SF-12),
 * - URL scheme `simplefit` (deep links: simplefit://app).
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
      {
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#0a0a0a" },
      },
    ],
    [
      "expo-localization",
      {
        supportedLocales: {
          ios: locales,
          android: locales,
        },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    router: {},
    eas: {
      projectId: "7564849d-49f1-4356-af4d-5ab2f3188299",
    },
  },
});
