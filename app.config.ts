import type { ConfigContext, ExpoConfig } from "expo/config";

import localeRegistry from "./src/shared/i18n/locales.json";

// Same registry the app uses (src/shared/i18n/locales.ts).
const locales = Object.keys(localeRegistry);

/**
 * Google Sign-In on iOS returns to the app through the reversed iOS client ID
 * as a URL scheme (SF-22). Without an iOS client ID the plugin is left out
 * and the app reports Google sign-in as unavailable on iOS.
 */
function googleSignInPlugin(): [string, { iosUrlScheme: string }][] {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClientId) return [];
  const match = /^([0-9]+-[a-z0-9]+)\.apps\.googleusercontent\.com$/.exec(iosClientId);
  if (!match) {
    throw new Error("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be a Google OAuth client ID");
  }
  return [
    [
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: `com.googleusercontent.apps.${match[1]}` },
    ],
  ];
}

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
    ...googleSignInPlugin(),
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
