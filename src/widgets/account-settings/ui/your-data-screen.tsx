import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Screen } from "@/shared/ui/screen";

import { SettingsNote, SettingsRow, SettingsSection, useRouteTitle } from "./settings-parts";

const CATEGORIES = ["account", "fighter", "coaching", "gyms"] as const;

/*
 * ST9 · Your data (SF-161; SetData.dc.html) on `mobile.settings.data`: the
 * kinds of data the backend keeps for an account, by domain. Export,
 * deletion and retention periods belong to SF-180: no export or deletion
 * API exists and no retention policy is approved, so none is requested,
 * scheduled or promised here (D-SF161-07).
 */
export function YourDataScreen() {
  useRouteTitle("mobile.settings.data");
  const t = useTranslations("accountSettings.data");
  return (
    <Screen>
      <View className="gap-5" testID="settings:data">
        <SettingsSection title={t("keptTitle")}>
          {CATEGORIES.map((category, index) => (
            <SettingsRow
              key={category}
              label={t(`categories.${category}.title`)}
              line={t(`categories.${category}.body`)}
              last={index === CATEGORIES.length - 1}
            />
          ))}
        </SettingsSection>
        <SettingsNote>{t("export")}</SettingsNote>
        <SettingsNote>{t("delete")}</SettingsNote>
      </View>
    </Screen>
  );
}
