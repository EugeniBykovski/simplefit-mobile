import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { useTranslations } from "use-intl";

import { startSession } from "@/entities/session";
import { authenticateWithGoogle } from "@/shared/api/generated/endpoints/auth/auth";
import { isApiError } from "@/shared/api/http/api-error";
import { configureGoogleSignIn, googleSignInAvailable } from "@/shared/lib/google-sign-in";
import { Button, type ButtonVariant } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";

type Failure = "rejected" | "rateLimited" | "unavailable" | "network" | "playServices" | "generic";

/**
 * "Continue with Google" (SF-22, simplefit-api ADR 0013).
 *
 * The native Google Sign-In sheet returns a Google ID token, which is
 * exchanged once at `POST /api/auth/google` (body transport) for a SimpleFit
 * session and then dropped: never stored, logged or sent anywhere else.
 * Cancelling the sheet is not an error. Both a new and an existing account
 * continue to `/`, the ENTRY route that resolves the destination
 * (route-architecture §9); no role is inferred here.
 */
export function GoogleSignInButton({ variant = "primary" }: { variant?: ButtonVariant }) {
  const t = useTranslations("auth.google");
  const router = useRouter();
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
    if (busy || !configureGoogleSignIn()) return;
    setBusy(true);
    setFailure(undefined);
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // cancelled by the user
      const idToken = response.data.idToken;
      if (idToken === null) throw new Error("Google returned no ID token");

      const session = await authenticateWithGoogle({
        id_token: idToken,
        refresh_token_transport: "body",
      });
      await startSession(session);
      router.replace("/");
    } catch (error) {
      const result = failureOf(error);
      if (result !== undefined) setFailure(result);
    } finally {
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
 * API errors map by code (never message); native errors by status code.
 * Returns undefined for outcomes that are not failures (cancel, in progress).
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
