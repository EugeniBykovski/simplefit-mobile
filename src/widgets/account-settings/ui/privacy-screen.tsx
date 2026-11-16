import { useRouter } from "expo-router";
import { UsersRound } from "lucide-react-native";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { routeHref } from "@/shared/routes/routes";
import { Screen } from "@/shared/ui/screen";

import { SettingsNote, SettingsRow, SettingsSection, useRouteTitle } from "./settings-parts";

const RULES = ["discovery", "coaches", "gyms", "body"] as const;

/*
 * S19 · Privacy (SF-161; PrivacySettings.dc.html) on `mobile.settings.privacy`.
 * The artboard's controls (default training visibility, discovery, sensitive
 * data switches) govern projections that do not exist: there are no public
 * profiles, feeds, search or shared trainings, so nothing could enforce them
 * (D-SF161-05). A switch that only changed local state would not be a privacy
 * control, so none is shown. Instead the screen states the rules the backend
 * enforces today for everyone, and links to the one choice that exists:
 * which coaches the fighter keeps (ending a relationship, FC2).
 */
export function PrivacyScreen() {
  useRouteTitle("mobile.settings.privacy");
  const t = useTranslations("accountSettings.privacy");
  const router = useRouter();
  return (
    <Screen>
      <View className="gap-5" testID="settings:privacy">
        <SettingsSection title={t("rulesTitle")}>
          {RULES.map((rule, index) => (
            <SettingsRow
              key={rule}
              label={t(`rules.${rule}.title`)}
              line={t(`rules.${rule}.body`)}
              last={index === RULES.length - 1}
            />
          ))}
        </SettingsSection>
        <SettingsNote>{t("noControls")}</SettingsNote>
        <SettingsSection>
          <SettingsRow
            icon={UsersRound}
            label={t("coachesLink")}
            onPress={() => router.push(routeHref("mobile.profile.coaches"))}
            last
          />
        </SettingsSection>
      </View>
    </Screen>
  );
}
