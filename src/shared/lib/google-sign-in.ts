import { GoogleSignin } from "@react-native-google-signin/google-signin";
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
 */
let configured = false;

/** Whether Google sign-in can run on this platform with the bundled configuration. */
export function googleSignInAvailable(): boolean {
  if (publicEnv.googleWebClientId === undefined) return false;
  return Platform.OS !== "ios" || publicEnv.googleIosClientId !== undefined;
}

/** Configures the native module once; returns false when not available. */
export function configureGoogleSignIn(): boolean {
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
  if (!configureGoogleSignIn()) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Local state only; the SimpleFit session is already revoked.
  }
}

/** Test seam: forget the configuration between tests. */
export function resetGoogleSignInForTests(): void {
  configured = false;
}
