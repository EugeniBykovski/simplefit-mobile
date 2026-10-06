import { useRouter } from "expo-router";
import { LogIn, LogOut } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { signOut, useSessionStatus } from "@/entities/session";
import { signOutOfGoogle } from "@/shared/lib/google-sign-in";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/**
 * Minimal session indicator (SF-22): sign out when signed in, a way to the
 * welcome screen otherwise. Sign-out revokes the session on the API, deletes
 * it from SecureStore and memory, and signs out of Google on the device.
 * Route guards are not decided here.
 */
export function SessionControl() {
  const t = useTranslations("auth.session");
  const status = useSessionStatus();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      await signOutOfGoogle();
    } finally {
      setSigningOut(false);
    }
  }

  if (status === "loading") return <Spinner label={t("checking")} />;

  if (status === "anonymous") {
    return (
      <View className="gap-3">
        <Text color="mutedForeground">{t("signedOut")}</Text>
        <Button
          label={t("signIn")}
          variant="quiet"
          icon={LogIn}
          onPress={() => router.push(routeHref("mobile.welcome"))}
        />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text color="mutedForeground">{t("signedIn")}</Text>
      <Button
        label={t("signOut")}
        variant="quiet"
        icon={LogOut}
        loading={signingOut}
        onPress={() => void handleSignOut()}
      />
    </View>
  );
}
