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
 * Verified invitation links (SF-80, docs/invitation-app-links.md): with
 * EXPO_PUBLIC_APP_LINK_HOST set, iOS (Associated Domains) and Android
 * (verified App Links) may open that domain's E08 invitation path,
 * `/invite/coach`, and nothing else, in the app. The domain must publish
 * `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
 * for this app's Team ID and signing certificates (simplefit-platform), or the
 * links keep opening the web page. Unset (the default): no domain is claimed.
 * Changing it needs a new native build.
 *
 * Same rule as src/shared/config/app-link-host.ts (this file can only import
 * JSON); src/shared/config/app-links.test.ts keeps the two in step.
 */
export function appLinkHost(value: string | undefined): string | undefined {
  const host = value?.trim().toLowerCase() ?? "";
  if (host === "") return undefined;
  const labels = host.split(".");
  const valid =
    host.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(label)) &&
    !/^\d+$/.test(labels.at(-1) ?? "");
  if (!valid) {
    throw new Error(
      "EXPO_PUBLIC_APP_LINK_HOST must be a domain name such as app.example.com (no scheme, port or path)",
    );
  }
  return host;
}

/** The E08 invitation link path (simplefit-api `Coaching.Invitations`). */
const INVITATION_LINK_PATH = "/invite/coach";

function appLinks(host: string | undefined) {
  if (host === undefined) return { ios: {}, android: {} };
  return {
    ios: { associatedDomains: [`applinks:${host}`] },
    android: {
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host, path: INVITATION_LINK_PATH }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
  };
}

/**
 * Expo app configuration. Identity values are permanent once published:
 * - bundle ID / package `com.simplefit.boxing` (chosen in SF-12),
 * - URL scheme `simplefit` (deep links: simplefit://app).
 */
const links = appLinks(appLinkHost(process.env.EXPO_PUBLIC_APP_LINK_HOST));

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
    // Sign in with Apple entitlement (SF-23); needs a new native build.
    usesAppleSignIn: true,
    ...links.ios,
  },

  android: {
    package: "com.simplefit.boxing",
    predictiveBackGestureEnabled: false,
    ...links.android,
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#0a0a0a" },
        // The Android splash theme needs a logo drawable even without artwork
        // (none is designed yet): an empty one keeps the colour-only splash.
        android: { drawable: { icon: "./assets/splash/splashscreen-logo-empty.xml" } },
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
