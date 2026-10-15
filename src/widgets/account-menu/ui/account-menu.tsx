import { useNavigation, useRouter } from "expo-router";
import { Settings, UsersRound } from "lucide-react-native";
import { useLayoutEffect } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { SignOutButton } from "@/features/sign-out";
import { routeHref } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

/*
 * The smallest real way into the account from the Fighter app (SF-28):
 * Claude Design F18 (Profile) links "Settings · account · privacy" to ST1
 * (Settings hub), whose last action is Sign out. Neither screen's other
 * content exists yet (profile stats, the settings rows), so each says so
 * plainly and offers only what works: the way to Settings, and Sign out.
 * SF-59 adds F18's Coaches row (Claude Design 1792069267-b198): the
 * fighter's real coaching relationships (FC1).
 */

/** F18's ways into Coaches and Settings, on the Profile tab (`mobile.profile`). */
export function ProfileScreen() {
  const t = useTranslations("accountMenu");
  const titles = useTranslations("routes.titles");
  const placeholder = useTranslations("shells.placeholder");
  const router = useRouter();

  return (
    <Screen edges={["top", "left", "right"]}>
      <View className="gap-4 pt-2" testID="account-menu:profile">
        <Badge label={placeholder("badge")} />
        <Text variant="h1" accessibilityRole="header">
          {titles("mobile/profile")}
        </Text>
        <Text color="mutedForeground">{t("profileNote")}</Text>
        <Button
          label={t("coachesLink")}
          variant="quiet"
          icon={UsersRound}
          onPress={() => router.push(routeHref("mobile.profile.coaches"))}
        />
        <Button
          label={t("settingsLink")}
          variant="quiet"
          icon={Settings}
          onPress={() => router.push(routeHref("mobile.settings"))}
        />
      </View>
    </Screen>
  );
}

/** ST1's Sign out, on the Settings route (`mobile.settings`). */
export function SettingsScreen() {
  const t = useTranslations("accountMenu");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const title = titles("mobile/settings");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  return (
    <Screen>
      <View className="gap-4 pt-2" testID="account-menu:settings">
        <Text color="mutedForeground">{t("settingsNote")}</Text>
        <SignOutButton />
      </View>
    </Screen>
  );
}
