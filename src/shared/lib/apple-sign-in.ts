import type * as AppleAuthenticationNative from "expo-apple-authentication";
import type * as CryptoNative from "expo-crypto";
import { Platform } from "react-native";

/**
 * Native Sign in with Apple (SF-23, simplefit-api ADR 0014) through
 * `expo-apple-authentication` (AuthenticationServices).
 *
 * - The identity token's audience is the bundle id `com.simplefit.boxing`.
 * - Every request carries the lowercase hex SHA-256 of a fresh raw nonce;
 *   only the raw nonce goes to the API, which checks the binding.
 * - No scopes: no name or email is requested, stored or logged.
 * - iOS only, and only in a development or release build with the Sign in
 *   with Apple entitlement (`ios.usesAppleSignIn`); never Expo Go.
 *
 * Like Google (google-sign-in.ts), the native modules are required on first
 * use, never at import time: Expo Router evaluates every route at startup,
 * so a binary without them must not stop the app. A missing module still
 * fails loudly when used.
 */
export type AppleAuthenticationModule = typeof AppleAuthenticationNative;

/** The native Apple authentication module, evaluated on first use. */
export function appleAuthenticationModule(): AppleAuthenticationModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred native module evaluation (see above)
  return require("expo-apple-authentication") as AppleAuthenticationModule;
}

function cryptoModule(): typeof CryptoNative {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred native module evaluation (see above)
  return require("expo-crypto") as typeof CryptoNative;
}

/** Whether Sign in with Apple can be offered here (iOS with Apple ID support). */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return appleAuthenticationModule().isAvailableAsync();
}

/**
 * A fresh nonce pair: `raw` (32 random bytes as 64 hex characters, sent to
 * the API) and `hashed` (its lowercase hex SHA-256, sent to Apple).
 */
export async function appleNonce(): Promise<{ raw: string; hashed: string }> {
  const crypto = cryptoModule();
  const raw = Array.from(crypto.getRandomBytes(32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const hashed = await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, raw, {
    encoding: crypto.CryptoEncoding.HEX,
  });
  return { raw, hashed: hashed.toLowerCase() };
}

/** Apple's code for a sign-in the user cancelled. */
export const APPLE_CANCELED = "ERR_REQUEST_CANCELED";
