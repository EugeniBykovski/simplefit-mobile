import { Redirect, useRouter } from "expo-router";
import { CircleAlert } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import {
  FIGHTER_MOBILE_FIRST_RUN,
  useFirstRun,
  useRecordFirstRunOutcome,
  type FirstRunOutcome,
} from "@/entities/first-run";
import { routeHref } from "@/shared/routes/routes";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

import { BoardArt, CornerArt, TimerArt } from "./intro-art";

/*
 * The Fighter mobile introduction (`mobile.welcome.tour`, SF-41; Claude
 * Design 34a FR1–FR3 at 390 × 844): three slides between Fighter onboarding
 * and the Fighter home.
 *
 * - It shows only while the backend reports the `fighter_mobile_first_run`
 *   experience `pending` (a completed Fighter whose introduction has no
 *   outcome yet). Completed or dismissed goes to the home; unavailable
 *   (onboarding not complete) goes back to the entry, which decides.
 * - "Let’s go" on FR3 records `completed`; "Skip intro" records `dismissed`.
 *   Either moves on only once the backend kept an outcome (the first one is
 *   final, on any device). A failure stays here with a retry.
 * - The slide shown is screen state only: an unfinished introduction is
 *   still `pending` and starts again at FR1 next time (nothing is stored).
 */

const SLIDES = ["board", "timer", "coach"] as const;
type Slide = (typeof SLIDES)[number];

const ART: Record<Slide, () => ReactNode> = {
  board: BoardArt,
  timer: TimerArt,
  coach: CornerArt,
};

const HOME = routeHref("mobile.home");

export function FirstRunIntroScreen() {
  const t = useTranslations("firstRunIntro");
  const state = useFirstRun(FIGHTER_MOBILE_FIRST_RUN);
  const settling = !state.isFetchedAfterMount && state.isFetching;

  if (state.data === undefined || settling) {
    return (
      <View className="flex-1 justify-center gap-3 bg-background px-5">
        {state.isError ? (
          <>
            <Notice tone="coral" icon={CircleAlert}>
              {t("saveFailed")}
            </Notice>
            <Button label={t("retry")} variant="quiet" onPress={() => void state.refetch()} />
          </>
        ) : (
          <Spinner label={t("loading")} />
        )}
      </View>
    );
  }
  if (state.data.status === "unavailable") return <Redirect href="/" />;
  if (state.data.status !== "pending") return <Redirect href={HOME} />;
  return <Intro />;
}

function Intro() {
  const t = useTranslations("firstRunIntro");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const record = useRecordFirstRunOutcome(FIGHTER_MOBILE_FIRST_RUN);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<FirstRunOutcome>();
  const [failed, setFailed] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const slide = SLIDES[index] ?? "board";
  const last = index === SLIDES.length - 1;
  const Art = ART[slide];

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  // Android's back button walks back through the slides.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index === 0) return false;
      setIndex(index - 1);
      return true;
    });
    return () => subscription.remove();
  }, [index]);

  async function finish(outcome: FirstRunOutcome) {
    if (busy !== undefined) return;
    setBusy(outcome);
    setFailed(false);
    try {
      await record(outcome);
      router.replace(HOME);
    } catch {
      setFailed(true);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    // Runtime inset: content scrolls below the status bar, never under it.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        ref={scroll}
        // The artboards' 58 pt top is the status bar plus 11 pt (nearest step: 12 pt).
        contentContainerClassName="grow gap-5.5 px-5 pb-6 pt-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <BrandMark size="sm" />
            <Text variant="label" color="faintForeground">
              {t("brand")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("skip")}
            accessibilityState={{ disabled: busy !== undefined, busy: busy === "dismissed" }}
            disabled={busy !== undefined}
            onPress={() => void finish("dismissed")}
            hitSlop={8}
            className="min-h-touch justify-center px-1"
          >
            <Text variant="bodySm" weight="extrabold" color="mutedForeground">
              {t("skip")}
            </Text>
          </Pressable>
        </View>
        <Art />
        <View className="gap-2.5">
          <Text variant="label" color="highlight">
            {t(`${slide}.label`)}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t(`${slide}.title`)}
          </Text>
          <Text variant="bodyLg" color="mutedForeground">
            {t(`${slide}.body`)}
          </Text>
        </View>
        {failed ? (
          <Notice tone="coral" icon={CircleAlert}>
            {t("saveFailed")}
          </Notice>
        ) : null}
      </ScrollView>
      <View
        className="flex-row items-center justify-between gap-4 px-5 pt-3"
        // Runtime inset: the artboards keep the action 34 pt above the bottom edge.
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("progress", { step: index + 1, total: SLIDES.length })}
          accessibilityValue={{ min: 1, max: SLIDES.length, now: index + 1 }}
          className="flex-row items-center gap-1.5"
        >
          {SLIDES.map((item, position) => (
            <View
              key={item}
              className={`h-2 rounded-full ${position === index ? "w-5.5 bg-highlight" : "w-2 bg-border-strong"}`}
            />
          ))}
        </View>
        <View className="w-48">
          <Button
            label={last ? t("finish") : t("next")}
            size="lg"
            loading={busy === "completed"}
            disabled={busy !== undefined}
            onPress={() => (last ? void finish("completed") : setIndex(index + 1))}
          />
        </View>
      </View>
    </View>
  );
}
