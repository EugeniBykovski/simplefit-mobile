import type * as GoogleSignInNative from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { publicEnv } from "@/shared/config/env";

/**
 * Native Google Sign-In (SF-22, simplefit-api ADR 0013) through
 * `@react-native-google-signin/google-signin` (the free "Original" module).
 *
 * - `webClientId` makes Google issue an ID token whose audience is the Web
 *   client on both platforms (on Android `azp` is the Android client). The
 *   API accepts only the configured audiences.
 * - iOS also needs its own client ID and the reversed client ID as a URL
 *   scheme (app.config.ts adds it through the module's config plugin).
 * - Android uses the legacy Google Sign-In SDK, which Google deprecates in
 *   favour of Credential Manager (documented technical debt).
 * - No scopes beyond the defaults, no offline access, no server auth code and
 *   no client secret. The ID token is never stored or logged.
 *
 * The native module is required on first use, never at import time. Expo
 * Router evaluates every route module at startup, so a top-level import made
 * the whole app fail to start when the binary lacked the module (Expo Go).
 * A missing module still fails loudly: the require throws and is not caught.
 * Development and release binaries must contain it.
 */
export type GoogleSignInModule = typeof GoogleSignInNative;

let configured = false;

/** The native Google Sign-In module, evaluated on first use (Metro caches it). */
export function googleSignInModule(): GoogleSignInModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred native module evaluation (see above)
  return require("@react-native-google-signin/google-signin") as GoogleSignInModule;
}

/** Whether Google sign-in can run on this platform with the bundled configuration. */
export function googleSignInAvailable(): boolean {
  if (publicEnv.googleWebClientId === undefined) return false;
  return Platform.OS !== "ios" || publicEnv.googleIosClientId !== undefined;
}

/** Configures the native module once; returns false when not available. */
export function configureGoogleSignIn({ GoogleSignin }: GoogleSignInModule): boolean {
  if (!googleSignInAvailable()) return false;
  if (!configured) {
    GoogleSignin.configure({
      webClientId: publicEnv.googleWebClientId,
      ...(Platform.OS === "ios" ? { iosClientId: publicEnv.googleIosClientId } : {}),
      offlineAccess: false,
    });
    configured = true;
  }
  return true;
}

/** Clears Google's local sign-in state after a SimpleFit sign-out (best effort). */
export async function signOutOfGoogle(): Promise<void> {
  if (!googleSignInAvailable()) return;
  const google = googleSignInModule();
  configureGoogleSignIn(google);
  try {
    await google.GoogleSignin.signOut();
  } catch {
    // Local state only; the SimpleFit session is already revoked.
  }
}

/** Test seam: forget the configuration between tests. */
export function resetGoogleSignInForTests(): void {
  configured = false;
}
