import { useTranslations } from "use-intl";

import { UnavailableSettings, useRouteTitle } from "./settings-parts";

/*
 * Settings whose domain does not exist yet (SF-161), each a truthful state
 * rather than a list, switch or connection the backend could not honour:
 * ST5 Blocked & muted (no social graph: SF-173–SF-177, D-SA32), ST6
 * Training & timer (no round timer or training log: SF-171) and ST7
 * Connected apps (no integration, no health data). Nothing is stored,
 * requested or shown as connected.
 */
export function BlockedScreen() {
  useRouteTitle("mobile.settings.blocked");
  const t = useTranslations("accountSettings.unavailableScreens.blocked");
  return <UnavailableSettings title={t("title")} body={t("body")} testID="settings:blocked" />;
}

export function TrainingSettingsScreen() {
  useRouteTitle("mobile.settings.training");
  const t = useTranslations("accountSettings.unavailableScreens.training");
  return <UnavailableSettings title={t("title")} body={t("body")} testID="settings:training" />;
}

export function ConnectedAppsScreen() {
  useRouteTitle("mobile.settings.apps");
  const t = useTranslations("accountSettings.unavailableScreens.apps");
  return <UnavailableSettings title={t("title")} body={t("body")} testID="settings:apps" />;
}
