import { useNavigation, useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useMyGymPages } from "@/entities/gym";
import { routeHref } from "@/shared/routes/routes";
import { initialsOf } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

import { contextOptions } from "../model/contexts";
import { isKnownEntry, type KnownEntry } from "../model/entry";
import { gymWorkspaceOptions, type GymWorkspace } from "../model/gyms";
import { ChooserRow } from "./chooser-row";
import { gymTarget, useContextSwitch } from "./context-switch";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

const NO_CONTINUATION = {};

type EnterableGym = Pick<GymWorkspace, "gym_id" | "name" | "role">;

/**
 * MGC1, the gym chooser (`mobile.gyms`, SF-89; the A04 row composition of
 * Claude Design Workspaces, without an artboard of its own:
 * D-MOBILE-GYM-SHELL-MVP), on the entry answered now:
 *
 * - where `gym_selection` lands (several gyms, or a completed gym and the
 *   owner's draft, without a remembered gym): no current context, so no
 *   Back; `footer` (Sign out) is the other way out;
 * - opened from A04's "All gyms": the same list, closed with Back.
 *
 * Rows: the entry's completed gyms (at most 25), then, while the entry counts
 * more, `GET /api/v1/me/gyms` page by page (completed gyms only: the draft is
 * always the user's own and the entry lists it); the owner's draft continues
 * setup; the account's completed profiles stay reachable. A single gym opens
 * at once. No gym offers gym registration. Every row comes from the backend.
 */
export function GymChooser({
  pending,
  failure,
  footer,
}: {
  pending: ReactNode;
  failure: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const query = useEntry(NO_CONTINUATION);
  const entry = query.data !== undefined && isKnownEntry(query.data) ? query.data : undefined;
  const only =
    entry !== undefined && entry.gym_workspace_count === 1
      ? gymWorkspaceOptions(entry).enter[0]
      : undefined;

  useEffect(() => {
    if (only !== undefined)
      router.replace(routeHref("mobile.gyms._gym-id.pulse", { gymId: only.gym_id }));
  }, [only, router]);

  if (query.isError || (query.data !== undefined && entry === undefined)) {
    return (
      <EntryFailureBoundary
        error={query.error ?? new Error("Unknown entry destination")}
        retry={() => void query.refetch()}
        failure={failure}
      />
    );
  }
  if (entry === undefined || only !== undefined) return pending;
  return <GymChooserView entry={entry} footer={footer} />;
}

function GymChooserView({ entry, footer }: { entry: KnownEntry; footer?: ReactNode }) {
  const t = useTranslations("gymShell.chooser");
  const roles = useTranslations("gymShell.roles");
  const contexts = useTranslations("contextSwitcher");
  const navigation = useNavigation();
  const router = useRouter();
  const gyms = gymWorkspaceOptions(entry);
  const { completed } = contextOptions(entry);
  const pages = useMyGymPages(gyms.more);
  const { state, open, openGym, continueGymSetup } = useContextSwitch();
  const busy = state.status === "pending";
  // Nothing to go back to when the entry asks for a gym.
  const selecting = entry.destination === "gym_selection";

  useLayoutEffect(() => {
    navigation.setOptions(
      selecting ? { headerShown: false, gestureEnabled: false } : { headerShown: true, title: "" },
    );
  }, [navigation, selecting]);

  const listed = new Set(entry.gym_workspaces.map((gym) => gym.gym_id));
  const extra: EnterableGym[] = (pages.data?.pages ?? [])
    .flatMap((page) => page.gyms)
    .filter((gym) => gym.setup_status === "completed" && !listed.has(gym.id))
    .map((gym) => ({ gym_id: gym.id, name: gym.name, role: gym.viewer.role }));
  const enter = [...gyms.enter, ...extra];
  const empty = enter.length === 0 && gyms.setup.length === 0;

  return (
    <Screen edges={selecting ? ["top", "bottom", "left", "right"] : undefined}>
      <View className="gap-5 pt-2">
        <View className="gap-1.5">
          <Text variant="label" color="faintForeground">
            {t("eyebrow")}
          </Text>
          <Text variant="h2" accessibilityRole="header">
            {empty ? t("empty.title") : t("title")}
          </Text>
          <Text variant="bodySm" color="mutedForeground">
            {empty ? t("empty.lead") : t("lead")}
          </Text>
        </View>

        {empty ? (
          <Button
            label={t("empty.action")}
            onPress={() => router.push(routeHref("mobile.onboarding.gym", {}, { intent: "gym" }))}
          />
        ) : null}

        {enter.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" color="faintForeground" accessibilityRole="header">
              {t("gyms")}
            </Text>
            {enter.map((gym) => (
              <ChooserRow
                key={gym.gym_id}
                title={gym.name}
                line={contexts("gymLine", { role: roles(gym.role) })}
                avatar={{ kind: "gym", initials: initialsOf(gym.name) }}
                opening={busy && state.target === gymTarget(gym.gym_id)}
                pending={busy}
                onPress={() => void openGym(gym.gym_id)}
              />
            ))}
            {pages.hasNextPage ? (
              <Button
                label={t("more", { count: entry.gym_workspace_count })}
                variant="quiet"
                disabled={pages.isFetching}
                loading={pages.isFetchingNextPage}
                onPress={() => void pages.fetchNextPage()}
              />
            ) : null}
            {pages.isError ? (
              <View accessibilityRole="alert">
                <Notice tone="amber" icon={CircleAlert}>
                  {t("moreFailed")}
                </Notice>
              </View>
            ) : null}
          </View>
        ) : null}

        {gyms.setup.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" color="faintForeground" accessibilityRole="header">
              {t("setup")}
            </Text>
            {gyms.setup.map((gym) => (
              <ChooserRow
                key={gym.gym_id}
                title={gym.name}
                line={t("draftLine")}
                avatar={{ kind: "journey" }}
                opening={busy && state.target === "gym-setup"}
                pending={busy}
                onPress={() => void continueGymSetup()}
              />
            ))}
          </View>
        ) : null}

        {completed.length > 0 ? (
          <View className="gap-2">
            <Text variant="label" color="faintForeground" accessibilityRole="header">
              {t("profiles")}
            </Text>
            {completed.map((context) => (
              <ChooserRow
                key={context}
                title={contexts(`contexts.${context}`)}
                line={contexts(`homes.${context}`)}
                avatar={{ kind: context, initials: contexts(`initials.${context}`) }}
                opening={busy && state.target === context}
                pending={busy}
                onPress={() => void open(context)}
              />
            ))}
          </View>
        ) : null}

        {state.status === "failed" ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Notice tone="amber" icon={CircleAlert}>
              {contexts("failed.select")}
            </Notice>
          </View>
        ) : null}
        {empty ? null : (
          <Text variant="caption" color="faintForeground" className="text-center">
            {contexts("notes.select")}
          </Text>
        )}
        {selecting ? footer : null}
      </View>
    </Screen>
  );
}
