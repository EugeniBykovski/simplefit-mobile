import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { signOut } from "@/entities/session";
import { signOutOfGoogle } from "@/shared/lib/google-sign-in";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";

/**
 * The Sign out action of the signed-in app (Claude Design ST1, SF-28): ends
 * the session on this device only — credentials deleted from SecureStore and
 * memory, the API asked to revoke it — and signs out of Google on the device
 * so it is not re-selected. The signed-in screens are then dismissed and the
 * welcome screen replaces them (ST1 → A01), so Back — Android's hardware
 * button included — has no signed-in screen to return to; the session gate
 * would redirect there too. Offline, the device still stops using its
 * credentials (nothing is queued).
 */
export function SignOutButton({ variant = "quiet" }: { variant?: "quiet" | "ghost" }) {
  const t = useTranslations("auth.session");
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
    if (router.canDismiss()) router.dismissAll();
    router.replace(routeHref("mobile.welcome"));
  }

  return (
    <Button
      label={t("signOut")}
      variant={variant}
      size={variant === "ghost" ? "sm" : "md"}
      icon={variant === "ghost" ? undefined : LogOut}
      loading={signingOut}
      accessibilityHint={t("signOutHint")}
      onPress={() => void handleSignOut()}
    />
  );
}
