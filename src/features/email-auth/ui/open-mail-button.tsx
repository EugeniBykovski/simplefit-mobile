import { Mail } from "lucide-react-native";
import { Linking, Platform } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";

/**
 * "Open Mail app" (O01c, O03), iOS only: `message://` opens the Mail inbox
 * through the system URL handler, without `canOpenURL` and therefore without
 * any Info.plist change or native rebuild (SF-24 D6). Android has no inbox
 * intent without a native module, so the action is omitted there. The flow
 * never depends on it.
 */
export function OpenMailButton() {
  const t = useTranslations("auth.code");
  if (Platform.OS !== "ios") return null;
  return (
    <Button
      label={t("openMail")}
      icon={Mail}
      variant="quiet"
      size="lg"
      onPress={() => {
        Linking.openURL("message://").catch(() => undefined);
      }}
    />
  );
}
