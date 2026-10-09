import { Redirect, useRouter } from "expo-router";
import { Bell, CircleAlert, CircleHelp, LayoutGrid } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";

import { FIGHTER_MOBILE_FIRST_RUN, useFirstRun } from "@/entities/first-run";
import { useFighterProfile } from "@/entities/fighter-profile";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { useSpotlightTarget } from "@/shared/ui/spotlight";
import { Text } from "@/shared/ui/text";

import { dayWithSimpleFit, headerDate } from "../model/home-date";
import { HomeTour } from "./home-tour";

/*
 * The Fighter home (`mobile.home`, SF-41; Claude Design 34a FR4 at 390 pt,
 * with the FR5 tour), the first screen of the Fighter app after onboarding.
 *
 * - The backend decides what shows: while the Fighter mobile introduction is
 *   `pending` it opens first (FR1–FR3, `mobile.welcome.tour`); once it was
 *   completed or skipped (here or on another device) this home shows; if
 *   Fighter onboarding is not complete (`unavailable`) the entry decides.
 * - Only real data: the Fighter's display name and the day since onboarding
 *   completed (FighterProfile). The checklist's steps belong to domains that
 *   do not exist yet (gym, bookings, round timer, training log, partners):
 *   none is ticked or linked, each says it is not available yet (as the web
 *   home). The Live Board is empty until training exists.
 * - The tour (FR5) is help: Help (?) or the Live Board card opens it, it
 *   points at the real header, checklist and tab bar, and records nothing.
 */

const CHECKLIST = ["gym", "classes", "timer", "training", "partners"] as const;

export function FighterHomeScreen() {
  const t = useTranslations("fighterHome");
  const profile = useFighterProfile();
  const firstRun = useFirstRun(FIGHTER_MOBILE_FIRST_RUN);
  const settling =
    (!profile.isFetchedAfterMount && profile.isFetching) ||
    (!firstRun.isFetchedAfterMount && firstRun.isFetching);

  if (profile.isError || firstRun.isError) {
    return (
      <View className="flex-1 justify-center gap-3 bg-background px-5">
        <Notice tone="coral" icon={CircleAlert}>
          {t("loadFailed")}
        </Notice>
        <Button
          label={t("retry")}
          variant="quiet"
          onPress={() => {
            void profile.refetch();
            void firstRun.refetch();
          }}
        />
      </View>
    );
  }
  if (profile.data === undefined || firstRun.data === undefined || settling) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner label={t("loading")} />
      </View>
    );
  }
  if (firstRun.data.status === "unavailable") return <Redirect href="/" />;
  if (firstRun.data.status === "pending")
    return <Redirect href={routeHref("mobile.welcome.tour")} />;
  return (
    <HomeView
      name={profile.data.display_name ?? ""}
      completedAt={profile.data.onboarding.completed_at}
    />
  );
}

function HomeView({ name, completedAt }: { name: string; completedAt: string | null }) {
  const t = useTranslations("fighterHome");
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [touring, setTouring] = useState(false);
  const identityTarget = useSpotlightTarget("home:identity");
  const notificationsTarget = useSpotlightTarget("home:notifications");
  const helpTarget = useSpotlightTarget("home:help");
  const checklistTarget = useSpotlightTarget("home:checklist");
  const now = new Date();
  const day = dayWithSimpleFit(completedAt, now);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  function startTour() {
    // The tour points at the header and the checklist: they must be in view.
    scroll.current?.scrollTo({ y: 0, animated: false });
    requestAnimationFrame(() => setTouring(true));
  }

  return (
    // Runtime inset: content scrolls below the status bar, never under it.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView ref={scroll} contentContainerClassName="gap-4 px-5 pb-6 pt-3">
        <View className="flex-row items-center justify-between gap-3">
          <View
            ref={identityTarget}
            accessible
            accessibilityLabel={`${name}, ${t("identity")}`}
            className="h-11 flex-row items-center gap-2.5 rounded-full border border-border bg-surface pl-1 pr-3.5"
          >
            <View className="size-9 items-center justify-center rounded-full bg-accent-strong">
              <Text variant="caption" weight="bold" color="highlight" className="font-display-bold">
                {initials}
              </Text>
            </View>
            <View className="flex-shrink">
              <Text variant="bodySm" weight="bold" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="label" color="mutedForeground">
                {t("identity")}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              ref={notificationsTarget}
              accessibilityRole="button"
              accessibilityLabel={t("notifications")}
              onPress={() => router.push(routeHref("mobile.notifications"))}
              className="size-11 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Icon icon={Bell} size={19} />
            </Pressable>
            <Pressable
              ref={helpTarget}
              accessibilityRole="button"
              accessibilityLabel={t("help")}
              onPress={startTour}
              className="size-11 items-center justify-center rounded-full border border-border bg-surface"
            >
              <Icon icon={CircleHelp} size={19} />
            </Pressable>
          </View>
        </View>

        <View className="gap-1.5">
          {day !== undefined ? (
            <Text variant="labelLg" color="faintForeground">
              {t("dateLine", { date: headerDate(locale, now), day })}
            </Text>
          ) : null}
          <Text variant="h1" accessibilityRole="header">
            {t("greeting", { name })}
            {"\n"}
            {t("greetingLine")}
          </Text>
        </View>

        <View
          ref={checklistTarget}
          className="gap-3 rounded-3xl border border-input bg-surface px-4.5 pb-2 pt-4.5"
        >
          <View className="flex-row items-end justify-between gap-3">
            <View className="gap-1">
              <Text variant="label" color="highlight">
                {t("checklist.label")}
              </Text>
              <Text variant="h3" accessibilityRole="header">
                {t("checklist.title")}
              </Text>
            </View>
            <Text
              variant="title"
              color="accentForeground"
              accessibilityLabel={t("checklist.progress", { done: 0, total: CHECKLIST.length })}
            >
              0<Text variant="title" color="faintForeground">{` / ${CHECKLIST.length}`}</Text>
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t("checklist.title")}
            accessibilityValue={{ min: 0, max: CHECKLIST.length, now: 0 }}
            className="h-1.5 w-full overflow-hidden rounded-full bg-border"
          />
          <View>
            {CHECKLIST.map((step, index) => (
              <View
                key={step}
                accessible
                accessibilityLabel={`${t(`checklist.steps.${step}`)}, ${t("checklist.notAvailable")}`}
                className={`min-h-14 flex-row items-center gap-3 py-1.5 ${index < CHECKLIST.length - 1 ? "border-b border-border" : ""}`}
              >
                <View className="size-6.5 rounded-full border-2 border-dashed border-accent-border" />
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight="extrabold">
                    {t(`checklist.steps.${step}`)}
                  </Text>
                  <Text variant="caption" color="faintForeground">
                    {t("checklist.notAvailable")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3 rounded-3xl border border-border bg-surface px-4.5 py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="label" color="faintForeground">
              {t("board.label")}
            </Text>
            <Text
              variant="badge"
              color="mutedForeground"
              className="rounded-sm bg-muted px-2.5 py-1"
            >
              {t("board.empty")}
            </Text>
          </View>
          <View className="flex-row items-center gap-3.5">
            <View className="size-14 items-center justify-center rounded-xl border-[1.5px] border-dashed border-accent-border">
              <Icon icon={LayoutGrid} size={22} color="highlight" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="extrabold">
                {t("board.title")}
              </Text>
              <Text variant="caption" color="mutedForeground">
                {t("board.body")}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("board.tourLabel")}
            onPress={startTour}
            className="min-h-touch justify-center self-start"
          >
            <Text variant="caption" weight="extrabold" color="highlight">
              {t("board.tour")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {touring ? <HomeTour onClose={() => setTouring(false)} /> : null}
    </View>
  );
}
