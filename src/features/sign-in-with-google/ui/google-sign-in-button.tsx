import { useState } from "react";
import { Platform, View } from "react-native";
import { useTranslations } from "use-intl";

import { completeAuthentication } from "@/entities/session";
import { authenticateWithGoogle } from "@/shared/api/generated/endpoints/auth/auth";
import { isApiError } from "@/shared/api/http/api-error";
import {
  configureGoogleSignIn,
  googleSignInAvailable,
  googleSignInModule,
  type GoogleSignInModule,
} from "@/shared/lib/google-sign-in";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";

type Failure = "rejected" | "rateLimited" | "unavailable" | "network" | "playServices" | "generic";

/**
 * "Continue with Google" (SF-22, simplefit-api ADR 0013).
 *
 * The native Google Sign-In sheet returns a Google ID token, which is
 * exchanged once at `POST /api/auth/google` (body transport) for a SimpleFit
 * session and then dropped: never stored, logged or sent anywhere else.
 * Cancelling the sheet is not an error. The session goes through
 * `completeAuthentication`, the pipeline shared with Apple and the email code
 * (SF-24); the guest-only gate then enters the application through the
 * backend entry resolution (SF-45). A new and an existing account are
 * treated alike; no role is inferred here, and Google never means Fighter.
 */
export function GoogleSignInButton({
  variant = "primary",
  compact = false,
}: {
  variant?: ButtonVariant;
  /** O01b / O02: the 50 pt side-by-side button labelled "Google". */
  compact?: boolean;
}) {
  const t = useTranslations("auth.google");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>();

  if (!googleSignInAvailable()) {
    return (
      <Text variant="bodySm" color="mutedForeground">
        {t("notConfigured")}
      </Text>
    );
  }

  async function signIn() {
    if (busy) return;
    // Not caught: a binary without the native module must fail loudly.
    const google = googleSignInModule();
    if (!configureGoogleSignIn(google)) return;
    setBusy(true);
    setFailure(undefined);
    try {
      if (Platform.OS === "android") {
        await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await google.GoogleSignin.signIn();
      if (!google.isSuccessResponse(response)) return; // cancelled by the user
      const idToken = response.data.idToken;
      if (idToken === null) throw new Error("Google returned no ID token");

      const session = await authenticateWithGoogle({
        id_token: idToken,
        refresh_token_transport: "body",
      });
      // The shared pipeline (SF-24): the guest-only gate then enters the app.
      if ((await completeAuthentication(session)) === "anonymous") setFailure("generic");
    } catch (error) {
      const result = failureOf(error, google);
      if (result !== undefined) setFailure(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <Button
        label={compact ? t("short") : t("continue")}
        variant={variant}
        size={compact ? "md" : "lg"}
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
 * API errors map by code (never message); native errors by status code.
 * Returns undefined for outcomes that are not failures (cancel, in progress).
 */
function failureOf(
  error: unknown,
  { isErrorWithCode, statusCodes }: GoogleSignInModule,
): Failure | undefined {
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
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
      case statusCodes.IN_PROGRESS:
        return undefined;
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return "playServices";
    }
  }
  return "generic";
}
