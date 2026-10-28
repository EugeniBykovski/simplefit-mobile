import { CircleAlert } from "lucide-react-native";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useCoachProfile } from "@/entities/coach-profile";
import { useFighterProfile } from "@/entities/fighter-profile";
import { routeHref } from "@/shared/routes/routes";
import { initialsOf } from "@/shared/ui/avatar";
import { Notice } from "@/shared/ui/notice";
import { Text } from "@/shared/ui/text";

import { contextOptions, type ProfileContext } from "../model/contexts";
import type { Entry } from "../model/entry";
import { gymWorkspaceOptions } from "../model/gyms";
import { ChooserRow, type RowAvatar } from "./chooser-row";
import { gymTarget, useContextSwitch, type SwitchTarget } from "./context-switch";

/**
 * Where the chooser is shown (Claude Design A04, version 1791994719-673f;
 * gym rows SF-89, D-MOBILE-GYM-SHELL-MVP):
 *
 * - `switch`: the "One account, every role" sheet opened from a home's
 *   identity pill; `current` is that home's context or gym (`gym:<id>`),
 *   checked and closing the sheet;
 * - `select`: the entry's `context_selection` (no current context): two
 *   completed contexts without a remembered choice, or two unfinished
 *   journeys (E11).
 */
export type ChooserMode = { kind: "switch"; current: SwitchTarget } | { kind: "select" };

type Row = {
  key: string;
  target: SwitchTarget;
  title: string;
  line: string;
  avatar: RowAvatar;
  current: boolean;
  run: () => void;
};

/**
 * The A04 rows on the entry (SF-51, SF-84): completed contexts (from
 * capabilities) open by recording the choice; the account's gym workspaces
 * follow, each completed gym opening its Gym pulse (the gym choice is
 * recorded) and the owner's draft continuing setup by intent; unfinished or
 * unstarted profile journeys continue by intent only. Every row comes from
 * the entry answered now, never from the device. Pending and failed states
 * keep the user where they are.
 */
export function ContextChooser({
  entry,
  mode,
  onCurrent,
  onLeave,
}: {
  entry: Entry;
  mode: ChooserMode;
  /** The current row: nothing to switch to (a sheet closes, a screen goes back). */
  onCurrent?: () => void;
  /** Runs just before leaving for another context, gym or journey (a sheet closes). */
  onLeave?: () => void;
}) {
  const t = useTranslations("contextSwitcher");
  const roles = useTranslations("gymShell.roles");
  const router = useRouter();
  const { completed, journeys } = contextOptions(entry);
  const gyms = gymWorkspaceOptions(entry);
  const { state, open, continueJourney, openGym, continueGymSetup } = useContextSwitch(onLeave);
  const names = useProfileNames(completed);
  const pending = state.status === "pending";
  const current = mode.kind === "switch" ? mode.current : undefined;
  // E11: nothing completed to open; only the journeys already started are offered.
  const setup = mode.kind === "select" && completed.length === 0 && gyms.enter.length === 0;
  const pick = (target: SwitchTarget, run: () => void) => () =>
    target === current ? onCurrent?.() : run();

  const profileRows: Row[] = completed.map((context) => {
    const name = names[context];
    return {
      key: `context-${context}`,
      target: context,
      title: t(`contexts.${context}`),
      line: [name, t(`homes.${context}`)].filter(Boolean).join(" · "),
      avatar: { kind: context, initials: name ? initialsOf(name) : t(`initials.${context}`) },
      current: context === current,
      run: pick(context, () => void open(context)),
    };
  });
  const gymRows: Row[] = [
    ...gyms.enter.map((gym) => ({
      key: `gym-${gym.gym_id}`,
      target: gymTarget(gym.gym_id),
      title: gym.name,
      line: t("gymLine", { role: roles(gym.role) }),
      avatar: { kind: "gym" as const, initials: initialsOf(gym.name) },
      current: gymTarget(gym.gym_id) === current,
      run: pick(gymTarget(gym.gym_id), () => void openGym(gym.gym_id)),
    })),
    ...gyms.setup.map((gym) => ({
      key: `gym-setup-${gym.gym_id}`,
      target: "gym-setup" as const,
      title: t("gymSetup"),
      line: t("gymDraftLine", { name: gym.name }),
      avatar: { kind: "journey" as const },
      current: false,
      run: () => void continueGymSetup(),
    })),
  ];
  const journeyRows: Row[] = journeys
    .filter((journey) => !setup || journey.started)
    .map((journey) => {
      const kind = journey.started ? "continue" : "start";
      return {
        key: `journey-${journey.context}`,
        target: journey.context,
        title: t(`${kind}.${journey.context}`),
        line: t(`${kind}Lines.${journey.context}`),
        avatar: { kind: "journey" },
        current: false,
        run: () => void continueJourney(journey.context),
      };
    });

  const rows = (list: Row[]) =>
    list.map((row) => (
      <ChooserRow
        key={row.key}
        title={row.title}
        line={row.line}
        avatar={row.avatar}
        current={row.current}
        opening={pending && state.target === row.target}
        pending={pending}
        onPress={row.run}
      />
    ));

  return (
    <View className="gap-3.5">
      <View className="gap-2">
        {rows(profileRows)}
        {gymRows.length > 0 ? (
          <Text
            variant="label"
            color="faintForeground"
            accessibilityRole="header"
            className="pt-1.5"
          >
            {t("gyms")}
          </Text>
        ) : null}
        {rows(gymRows)}
        {gyms.more ? (
          <ChooserRow
            title={t("allGyms", { count: entry.gym_workspace_count })}
            line={t("allGymsLine")}
            avatar={{ kind: "more" }}
            pending={pending}
            onPress={() => {
              onLeave?.();
              router.push(routeHref("mobile.gyms"));
            }}
          />
        ) : null}
        {rows(journeyRows)}
      </View>
      {state.status === "failed" ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice tone="amber" icon={CircleAlert}>
            {t(mode.kind === "switch" ? "failed.switch" : "failed.select")}
          </Notice>
        </View>
      ) : null}
      <Text variant="caption" color="faintForeground" className="text-center">
        {t(mode.kind === "switch" ? "notes.switch" : setup ? "notes.setup" : "notes.select")}
      </Text>
    </View>
  );
}

/** The display names of the completed contexts' profiles, for their rows. */
function useProfileNames(completed: readonly ProfileContext[]) {
  const fighter = useFighterProfile({ enabled: completed.includes("fighter") });
  const coach = useCoachProfile({ enabled: completed.includes("coach") });
  return {
    fighter: fighter.data?.display_name ?? undefined,
    coach: coach.data?.display_name ?? undefined,
  } satisfies Record<ProfileContext, string | undefined>;
}
