import { Redirect, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { routeHref } from "@/shared/routes/routes";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

import { contextOptions, type ProfileContext } from "../model/contexts";
import { destinationRoute, entryHref, isKnownEntry, type KnownEntry } from "../model/entry";
import { ContextChooser, type ChooserMode } from "./context-chooser";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

const NO_CONTINUATION = {};

/** The home destinations and the context each one is. */
const HOME_CONTEXT: Partial<Record<KnownEntry["destination"], ProfileContext>> = {
  fighter_home: "fighter",
  coach_home: "coach",
};

/**
 * A04 as a screen (`mobile.workspaces`, SF-55; Claude Design Workspaces,
 * version 1791994719-673f), on the entry answered now:
 *
 * - `context_selection` (SF-51): where the entry lands when two completed
 *   contexts have no remembered choice (mode `choose`) or two journeys are in
 *   progress (E11, mode `setup`). There is no current context: no Back, no
 *   dismiss; `footer` (Sign out) is the other way out.
 * - a home (`fighter_home`, `coach_home`): the `/workspaces` link opened in a
 *   context; the switcher with that context checked, closed with Back.
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
  const current = HOME_CONTEXT[entry.destination];
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
  const setup = selecting && contextOptions(entry).completed.length === 0;
  const copy = selecting ? (setup ? "setup" : "choose") : "switch";
  const eyebrow = selecting ? t(`${setup ? "setup" : "choose"}.eyebrow`) : undefined;

  useLayoutEffect(() => {
    // Nothing to go back to while the entry asks for a choice.
    navigation.setOptions(
      selecting ? { headerShown: false, gestureEnabled: false } : { headerShown: true, title: "" },
    );
  }, [navigation, selecting, t]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routeHref(destinationRoute(entry.destination)));
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
            {t(`${copy}.lead`)}
          </Text>
        </View>
        <ContextChooser entry={entry} mode={mode} onCurrent={selecting ? undefined : close} />
        {footer}
      </View>
    </Screen>
  );
}
