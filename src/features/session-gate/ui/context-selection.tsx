import { Redirect, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { routeHref } from "@/shared/routes/routes";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

import { contextOptions } from "../model/contexts";
import {
  destinationParams,
  destinationRoute,
  entryHref,
  isKnownEntry,
  type KnownEntry,
} from "../model/entry";
import { gymWorkspaceOptions } from "../model/gyms";
import { ContextChooser, type ChooserMode } from "./context-chooser";
import { gymTarget, type SwitchTarget } from "./context-switch";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

const NO_CONTINUATION = {};

/** The context a home destination is: a profile, or the gym it names (SF-89). */
function homeContext(entry: KnownEntry): SwitchTarget | undefined {
  if (entry.destination === "fighter_home") return "fighter";
  if (entry.destination === "coach_home") return "coach";
  if (entry.destination === "gym_home" && entry.gym_id !== null) return gymTarget(entry.gym_id);
  return undefined;
}

/**
 * A04 as a screen (`mobile.workspaces`, SF-55; Claude Design Workspaces,
 * version 1791994719-673f), on the entry answered now:
 *
 * - `context_selection` (SF-51): where the entry lands when two completed
 *   contexts have no remembered choice (mode `choose`) or two journeys are in
 *   progress (E11, mode `setup`). There is no current context: no Back, no
 *   dismiss; `footer` (Sign out) is the other way out.
 * - a home (`fighter_home`, `coach_home`, `gym_home`): the `/workspaces`
 *   link opened in a context; the switcher with that context (or gym)
 *   checked, closed with Back.
 * - anything else (an unfinished onboarding, account registration): that
 *   destination, never a chooser the backend did not ask for.
 *
 * A destination this client does not map is a failure, never guessed.
 */
export function ContextSelection({
  pending,
  failure,
  footer,
}: {
  pending: ReactNode;
  failure: ReactNode;
  footer?: ReactNode;
}) {
  const query = useEntry(NO_CONTINUATION);
  const entry = query.data !== undefined && isKnownEntry(query.data) ? query.data : undefined;

  if (query.isError || (query.data !== undefined && entry === undefined)) {
    return (
      <EntryFailureBoundary
        error={query.error ?? new Error("Unknown entry destination")}
        retry={() => void query.refetch()}
        failure={failure}
      />
    );
  }
  if (entry === undefined) return pending;
  if (entry.destination === "context_selection") {
    return <Chooser entry={entry} mode={{ kind: "select" }} footer={footer} />;
  }
  const current = homeContext(entry);
  if (current === undefined) return <Redirect href={entryHref(entry)} />;
  return <Chooser entry={entry} mode={{ kind: "switch", current }} />;
}

function Chooser({
  entry,
  mode,
  footer,
}: {
  entry: KnownEntry;
  mode: ChooserMode;
  footer?: ReactNode;
}) {
  const t = useTranslations("contextSwitcher");
  const navigation = useNavigation();
  const router = useRouter();
  const selecting = mode.kind === "select";
  const setup =
    selecting &&
    contextOptions(entry).completed.length === 0 &&
    gymWorkspaceOptions(entry).enter.length === 0;
  const mixed = entry.gym_workspaces.length > 0;
  const copy = selecting ? (setup ? "setup" : "choose") : "switch";
  // Only gyms to open (no completed profile): the rows are the user's gyms.
  const gymsOnly = selecting && !setup && contextOptions(entry).completed.length === 0;
  const eyebrow = selecting
    ? gymsOnly
      ? t("gyms")
      : t(`${setup ? "setup" : "choose"}.eyebrow`)
    : undefined;

  useLayoutEffect(() => {
    // Nothing to go back to while the entry asks for a choice.
    navigation.setOptions(
      selecting ? { headerShown: false, gestureEnabled: false } : { headerShown: true, title: "" },
    );
  }, [navigation, selecting, t]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else
      router.replace(
        routeHref(destinationRoute(entry.destination), destinationParams(entry) ?? {}),
      );
  };

  return (
    <Screen edges={selecting ? ["top", "bottom", "left", "right"] : undefined}>
      <View className="gap-5 pt-2">
        <View className="gap-1.5">
          {eyebrow !== undefined ? (
            <Text variant="label" color="faintForeground">
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="h2" accessibilityRole="header">
            {t(`${copy}.title`)}
          </Text>
          <Text variant="bodySm" color="mutedForeground">
            {selecting && mixed ? t(`${setup ? "setup" : "choose"}.leadMixed`) : t(`${copy}.lead`)}
          </Text>
        </View>
        <ContextChooser entry={entry} mode={mode} onCurrent={selecting ? undefined : close} />
        {footer}
      </View>
    </Screen>
  );
}
