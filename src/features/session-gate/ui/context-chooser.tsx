import { Check, CircleAlert, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import { useCoachProfile } from "@/entities/coach-profile";
import { useFighterProfile } from "@/entities/fighter-profile";
import { initialsOf } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

import { contextOptions, type ProfileContext } from "../model/contexts";
import type { Entry } from "../model/entry";
import { useContextSwitch } from "./context-switch";

/**
 * Where the chooser is shown (Claude Design A04, version 1791994719-673f):
 *
 * - `switch`: the "One account, every role" sheet opened from a home's
 *   identity pill; `current` is that home's context, checked and closing
 *   the sheet;
 * - `select`: the entry's `context_selection` (no current context): two
 *   completed contexts without a remembered choice, or two unfinished
 *   journeys (E11).
 */
export type ChooserMode = { kind: "switch"; current: ProfileContext } | { kind: "select" };

type Row = {
  key: string;
  context: ProfileContext;
  title: string;
  line: string;
  initials: string;
  journey: boolean;
  current: boolean;
  run: () => void;
};

/**
 * The A04 rows on the SF-51 entry: completed contexts (from capabilities)
 * open by recording the choice; unfinished or unstarted journeys continue by
 * intent only. Pending and failed states keep the user where they are.
 */
export function ContextChooser({
  entry,
  mode,
  onCurrent,
  onLeave,
}: {
  entry: Entry;
  mode: ChooserMode;
  /** The current context's row: nothing to switch to (a sheet closes, a screen goes back). */
  onCurrent?: () => void;
  /** Runs just before leaving for another context or journey (a sheet closes). */
  onLeave?: () => void;
}) {
  const t = useTranslations("contextSwitcher");
  const { completed, journeys } = contextOptions(entry);
  const { state, open, continueJourney } = useContextSwitch(onLeave);
  const names = useProfileNames(completed);
  const pending = state.status === "pending";
  const current = mode.kind === "switch" ? mode.current : undefined;
  // E11: no completed context to open; only the journeys already started are offered.
  const setup = mode.kind === "select" && completed.length === 0;

  const rows: Row[] = [
    ...completed.map((context) => {
      const name = names[context];
      return {
        key: `context-${context}`,
        context,
        title: t(`contexts.${context}`),
        line: [name, t(`homes.${context}`)].filter(Boolean).join(" · "),
        initials: name ? initialsOf(name) : t(`initials.${context}`),
        journey: false,
        current: context === current,
        run: () => (context === current ? onCurrent?.() : void open(context)),
      };
    }),
    ...journeys
      .filter((journey) => !setup || journey.started)
      .map((journey) => {
        const kind = journey.started ? "continue" : "start";
        return {
          key: `journey-${journey.context}`,
          context: journey.context,
          title: t(`${kind}.${journey.context}`),
          line: t(`${kind}Lines.${journey.context}`),
          initials: "",
          journey: true,
          current: false,
          run: () => void continueJourney(journey.context),
        };
      }),
  ];

  return (
    <View className="gap-3.5">
      <View className="gap-2">
        {rows.map((row) => {
          const opening = pending && state.context === row.context;
          return (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}, ${row.line}`}
              accessibilityState={{ selected: row.current, disabled: pending, busy: opening }}
              disabled={pending}
              onPress={row.run}
              className={`min-h-16 flex-row items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${
                row.current ? "border-primary bg-surface-elevated" : "border-border"
              } ${pending && !opening ? "opacity-50" : ""}`}
            >
              <View
                className={`size-10 items-center justify-center rounded-full ${
                  row.journey
                    ? "border-[1.5px] border-dashed border-accent-border"
                    : row.context === "coach"
                      ? "bg-warning"
                      : "bg-highlight"
                }`}
              >
                {row.journey ? (
                  <Icon icon={Plus} size={18} color="highlight" />
                ) : (
                  <Text
                    variant="caption"
                    weight="bold"
                    color={row.context === "coach" ? "warningForeground" : "highlightForeground"}
                    className="font-display-bold"
                  >
                    {row.initials}
                  </Text>
                )}
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="extrabold">
                  {row.title}
                </Text>
                <Text variant="label" color={row.current ? "highlight" : "faintForeground"}>
                  {row.line}
                </Text>
              </View>
              {opening ? (
                <View className="flex-row items-center gap-2">
                  <Spinner label={t("opening")} />
                  <Text variant="caption" weight="extrabold" color="highlight">
                    {t("opening")}
                  </Text>
                </View>
              ) : row.current ? (
                <View className="size-6.5 items-center justify-center rounded-full bg-primary">
                  <Icon icon={Check} size={14} color="primaryForeground" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
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
