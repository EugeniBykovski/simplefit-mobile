import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { startSession } from "@/entities/session";
import { authenticateWithApple } from "@/shared/api/generated/endpoints/auth/auth";
import { isApiError } from "@/shared/api/http/api-error";
import {
  APPLE_CANCELED,
  appleAuthenticationModule,
  appleNonce,
  appleSignInAvailable,
} from "@/shared/lib/apple-sign-in";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";

type Failure = "rejected" | "rateLimited" | "unavailable" | "network" | "generic";

/**
 * "Continue with Apple" (SF-23, simplefit-api ADR 0014). Rendered only on
 * iOS when Sign in with Apple is available.
 *
 * The native sheet returns an Apple identity token for a request carrying
 * the SHA-256 of a fresh raw nonce; the token and the raw nonce are
 * exchanged once at `POST /api/auth/apple` (body transport) for a SimpleFit
 * session and then dropped. No scopes are requested and nothing but the
 * token and nonce is sent (no authorization code, name, email or user id).
 * Cancelling is silent. Both a new and an existing account continue to `/`,
 * the ENTRY route (route-architecture §9), like Google.
 */
export function AppleSignInButton({ variant = "secondary" }: { variant?: ButtonVariant }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void appleSignInAvailable().then((result) => {
      if (active) setAvailable(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return available ? <AppleButton variant={variant} /> : null;
}

function AppleButton({ variant }: { variant: ButtonVariant }) {
  const t = useTranslations("auth.apple");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>();
  // Guards against a second press before React re-renders the busy state.
  const inFlight = useRef(false);

  async function signIn() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      const nonce = await appleNonce();
      const credential = await appleAuthenticationModule().signInAsync({
        requestedScopes: [],
        nonce: nonce.hashed,
      });
      if (!credential.identityToken) {
        setFailure("generic");
        return;
      }

      const session = await authenticateWithApple({
        id_token: credential.identityToken,
        nonce: nonce.raw,
        refresh_token_transport: "body",
      });
      await startSession(session);
      router.replace("/");
    } catch (error) {
      const result = failureOf(error);
      if (result !== undefined) setFailure(result);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <Button
        label={t("continue")}
        variant={variant}
        size="lg"
        loading={busy}
        accessibilityHint={busy ? t("exchanging") : undefined}
        onPress={() => void signIn()}
      />
      {failure ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2"
        >
          <Text variant="bodySm" color="destructiveSubtleForeground">
            {t(`errors.${failure}`)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * API errors map by code (never message). Returns undefined for a user
 * cancellation, which is not a failure.
 */
function failureOf(error: unknown): Failure | undefined {
  if (isApiError(error)) {
    if (error.kind !== "http") return "network";
    switch (error.code) {
      case "unauthorized":
        return "rejected";
      case "rate_limited":
        return "rateLimited";
      case "service_unavailable":
        return "unavailable";
      default:
        return "generic";
    }
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === APPLE_CANCELED) return undefined;
  }
  return "generic";
}
