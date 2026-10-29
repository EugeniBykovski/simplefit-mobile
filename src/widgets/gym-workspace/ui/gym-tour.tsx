import { Check, CircleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import type { GymFirstRun } from "@/entities/gym-first-run";
import { themeVariables } from "@/shared/styles/tokens";
import { useTheme } from "@/shared/styles/theme";
import { Icon } from "@/shared/ui/icon";
import { Spinner } from "@/shared/ui/spinner";
import { Spotlight, useSpotlightTargets } from "@/shared/ui/spotlight";
import { Text } from "@/shared/ui/text";

import { GYM_TOUR_DONE, GYM_TOUR_STEPS, type GymTourStep } from "../model/tour";

type TourView = number | "done" | "confirm";

/** Re-measure after the app returns to the foreground (layout may have changed meanwhile). */
function useForegroundTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") setTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);
  return tick;
}

/**
 * GR2 (Claude Design 112, `FirstRunGCheckinTip`): the gym owner's four-step
 * introduction on real Gym pulse UI (the checklist, the gym card, the tab
 * bar's Soon items, the identity pill), then the complete card. Each step
 * scrolls its target into view (`reveal`) and measures it in window
 * coordinates when it shows, again when the window changes size (rotation,
 * text size), when the page under it reflows (`layout`) and when the app
 * returns to the foreground; a target that is
 * not mounted or laid out gets no ring and no arrow: the card stays at the
 * top of a dimmed screen. The card is the bone coach mark of FR5 (the
 * opposite theme's tokens). One modal: VoiceOver and TalkBack stay inside,
 * and each step is announced with its position.
 *
 * Only explicit ends reach the backend, and only its answer moves the tour:
 *
 * - Finish (step 4) → `onComplete`: "Finishing…", then the complete card
 *   when the backend keeps `completed`; a failure keeps step 4 with Try
 *   again. Another outcome kept elsewhere is the caller's to show.
 * - End tour → a confirmation in the card; End introduction → `onDismiss`,
 *   then the tour closes; a failure keeps the confirmation with the error.
 * - Back (the button, Android Back) goes one step back; on step 1 it asks to
 *   end, on the confirmation it keeps going. Back never records anything.
 *
 * The step is client-only: a resumed tour starts at step 1 on any device.
 */
export function GymTour({
  gymName,
  layout,
  reveal,
  onComplete,
  onDismiss,
  onClose,
}: {
  gymName: string;
  /** Changes whenever Gym pulse reflows under the tour (the introduction card becomes a notice): re-measure. */
  layout: string;
  /** Scrolls Gym pulse so the step's target is in view; resolves once laid out. */
  reveal: (step: GymTourStep) => Promise<void>;
  /** `completeGymFirstRun`: the state the backend keeps. */
  onComplete: () => Promise<GymFirstRun>;
  /** `dismissGymFirstRun`: the state the backend keeps. */
  onDismiss: () => Promise<GymFirstRun>;
  onClose: () => void;
}) {
  const t = useTranslations("gymShell.firstRun.tour");
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const foreground = useForegroundTick();
  const { measure } = useSpotlightTargets();
  const [view, setView] = useState<TourView>(0);
  const [returnTo, setReturnTo] = useState(0);
  const [saving, setSaving] = useState<"complete" | "dismiss">();
  const [failed, setFailed] = useState<"complete" | "dismiss">();
  const [measured, setMeasured] = useState<{ id: string; rect: LayoutRectangle | undefined }>();
  const [cardHeight, setCardHeight] = useState(0);

  const total = GYM_TOUR_STEPS.length;
  const index = typeof view === "number" ? view : undefined;
  const step =
    view === "done" ? GYM_TOUR_DONE : (GYM_TOUR_STEPS[index ?? returnTo] ?? GYM_TOUR_STEPS[0]!);
  const last = index === total - 1;
  // A rectangle measured for another step is never shown for this one.
  const target = measured?.id === step.target ? measured.rect : undefined;

  useEffect(() => {
    let current = true;
    void reveal(step).then(() =>
      measure(step.target).then((rect) => {
        if (current) setMeasured({ id: step.target, rect });
      }),
    );
    return () => {
      current = false;
    };
  }, [step, reveal, measure, window.width, window.height, window.fontScale, foreground, layout]);

  const label =
    view === "done"
      ? t("complete")
      : view === "confirm"
        ? t("confirm.label")
        : t("step", { step: (index ?? 0) + 1, total });
  const title =
    view === "done"
      ? t("steps.done.title")
      : view === "confirm"
        ? t("confirm.title")
        : saving === "complete"
          ? t("finishing.title")
          : failed === "complete"
            ? t("finishFailed.title")
            : t(`steps.${step.id}.title`);
  const body =
    view === "done"
      ? t("steps.done.body")
      : view === "confirm"
        ? t("confirm.body")
        : saving === "complete"
          ? t("finishing.body")
          : failed === "complete"
            ? t("finishFailed.body")
            : step.id === "switcher"
              ? t("steps.switcher.body", { name: gymName })
              : t(`steps.${step.id}.body`);

  // Screen readers hear each step with its position (the spotlight is visual only).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${label}. ${title}. ${body}`);
  }, [label, title, body]);

  const go = (to: number) => {
    setFailed(undefined);
    setView(Math.min(Math.max(to, 0), total - 1));
  };
  const askEnd = () => {
    if (index !== undefined) setReturnTo(index);
    setFailed(undefined);
    setView("confirm");
  };
  const keepGoing = () => {
    setFailed(undefined);
    setView(returnTo);
  };

  const finish = async () => {
    if (saving !== undefined) return;
    setSaving("complete");
    setFailed(undefined);
    try {
      const kept = await onComplete();
      if (kept.status === "completed") setView("done");
    } catch {
      setFailed("complete");
    } finally {
      setSaving(undefined);
    }
  };

  const dismiss = async () => {
    if (saving !== undefined) return;
    setSaving("dismiss");
    setFailed(undefined);
    try {
      await onDismiss();
      onClose();
    } catch {
      setFailed("dismiss");
    } finally {
      setSaving(undefined);
    }
  };

  const back = () => {
    if (saving !== undefined) return;
    if (view === "done") onClose();
    else if (view === "confirm") keepGoing();
    else if (index !== undefined && index > 0) go(index - 1);
    else askEnd();
  };

  const primaryLabel =
    view === "done"
      ? t("toPulse")
      : saving === "complete"
        ? t("finishing.button")
        : failed === "complete"
          ? t("tryAgain")
          : last
            ? t("finish")
            : t("next");

  const card = (
    <View
      onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      accessibilityLabel={`${label}. ${title}`}
      className="gap-2.5 rounded-3xl bg-background p-4.5"
      // The opposite theme's tokens, scoped to the card (bone on graphite), as FR5.
      style={themeVariables(scheme === "dark" ? "light" : "dark")}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="label"
          color={view === "confirm" ? "warningSubtleForeground" : "primary"}
          className="flex-shrink"
        >
          {label}
        </Text>
        {view === "done" ? (
          <View className="size-5.5 items-center justify-center rounded-full bg-primary">
            <Icon icon={Check} size={13} color="primaryForeground" />
          </View>
        ) : index !== undefined ? (
          <View className="flex-row gap-0.5" importantForAccessibility="no-hide-descendants">
            {GYM_TOUR_STEPS.map((item, position) => (
              <View
                key={item.id}
                className={`h-1 w-3 rounded-full ${position <= index ? "bg-primary" : "bg-border-strong"}`}
              />
            ))}
          </View>
        ) : null}
      </View>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodySm" color="mutedForeground">
        {body}
      </Text>
      {failed !== undefined ? (
        <View
          accessibilityRole="alert"
          className="flex-row items-center gap-2 rounded-md border border-warning-border bg-warning-subtle px-2.5 py-2"
        >
          <Icon icon={CircleAlert} size={14} color="warning" />
          <Text
            variant="caption"
            weight="bold"
            color="warningSubtleForeground"
            className="flex-shrink"
          >
            {t("failed")}
          </Text>
        </View>
      ) : null}
      <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2">
        {view === "done" ? (
          <View />
        ) : (
          <CardButton
            label={view === "confirm" ? t("confirm.keep") : t("end")}
            kind="link"
            disabled={saving !== undefined}
            onPress={view === "confirm" ? keepGoing : askEnd}
          />
        )}
        <View className="flex-row gap-2">
          {index !== undefined && index > 0 ? (
            <CardButton
              label={t("back")}
              kind="outline"
              disabled={saving !== undefined}
              onPress={() => go(index - 1)}
            />
          ) : null}
          {view === "confirm" ? (
            <CardButton
              label={t("confirm.end")}
              kind="warning"
              busy={saving === "dismiss"}
              disabled={saving !== undefined}
              onPress={() => void dismiss()}
            />
          ) : (
            <CardButton
              label={primaryLabel}
              kind="primary"
              busy={saving === "complete"}
              disabled={saving !== undefined}
              onPress={() => {
                if (view === "done") onClose();
                else if (last) void finish();
                else if (index !== undefined) go(index + 1);
              }}
            />
          )}
        </View>
      </View>
    </View>
  );

  return (
    <Spotlight
      visible
      target={target}
      padding={step.padding}
      radius={step.radius}
      insets={{ top: insets.top, bottom: insets.bottom }}
      card={card}
      cardHeight={cardHeight}
      onRequestClose={back}
    />
  );
}

/** The coach mark's buttons (44 pt, as FR5): End / Keep going, Back, and the primary action. */
function CardButton({
  label,
  kind,
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string;
  kind: "link" | "outline" | "primary" | "warning";
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const box = {
    link: "min-h-touch justify-center",
    outline: "h-11 justify-center rounded-md-lg border border-input px-4",
    primary: "h-11 flex-row items-center justify-center gap-2 rounded-md-lg bg-foreground px-4.5",
    warning: "h-11 flex-row items-center justify-center gap-2 rounded-md-lg bg-warning px-4.5",
  }[kind];
  const color = {
    link: "mutedForeground",
    outline: "foreground",
    primary: "secondaryForeground",
    warning: "warningForeground",
  } as const;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      hitSlop={kind === "link" ? 8 : undefined}
      onPress={onPress}
      className={`${box} ${disabled && !busy ? "opacity-60" : ""}`}
    >
      {busy ? <Spinner size="small" label={label} /> : null}
      <Text variant="bodySm" weight="extrabold" color={color[kind]}>
        {label}
      </Text>
    </Pressable>
  );
}
