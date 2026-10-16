import { Check, ChevronDown, ChevronRight, CircleAlert, Info } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";

import { useCoachProfile, type CoachProfile } from "@/entities/coach-profile";
import { ContextSwitcherSheet } from "@/features/session-gate";
import { countryName } from "@/shared/lib/countries";
import { routeHref } from "@/shared/routes/routes";
import { Avatar, initialsOf } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

/*
 * C01 Coach today (`mobile.coach.today`, SF-55; Claude Design CoachToday,
 * version 1791994719-673f, 390 pt), the first screen of the Coach app.
 *
 * - Only real data: the CoachProfile (SF-50). Fighters and invitations
 *   open the Fighters tab (SF-61, Claude Design 1792155768-3179) without
 *   counts; sessions have no domain yet: a dash, never a zero.
 * - The identity pill opens A04, "One account, every role" (the context
 *   switcher sheet). Behind the Coach CapabilityGate (COACH from the entry).
 */

/** What fills this screen: Fighters and Invitations open the Fighters tab (SF-61); sessions do not exist yet. */
const OPEN_FILLS = { fighters: {}, invitations: { view: "invitations" } } as const;
const LATER_STEPS = ["session"] as const;

export function CoachTodayScreen() {
  const t = useTranslations("coachHome");
  const profile = useCoachProfile();

  if (profile.isError) {
    return (
      <View className="flex-1 justify-center gap-3 bg-background px-5">
        <Notice tone="coral" icon={CircleAlert}>
          {t("loadFailed")}
        </Notice>
        <Button label={t("retry")} variant="quiet" onPress={() => void profile.refetch()} />
      </View>
    );
  }
  if (profile.data === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner label={t("loading")} />
      </View>
    );
  }
  return <TodayView profile={profile.data} />;
}

function TodayView({ profile }: { profile: CoachProfile }) {
  const t = useTranslations("coachHome");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [switching, setSwitching] = useState(false);
  const name = profile.display_name ?? "";

  return (
    // Runtime inset: content scrolls below the status bar, never under it.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-6 pt-3">
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("switchProfile", { name })}
            onPress={() => setSwitching(true)}
            className="h-11 flex-row items-center gap-2.5 rounded-full border border-border bg-surface pl-1 pr-3.5"
          >
            <View className="size-9 items-center justify-center rounded-full bg-warning">
              <Text
                variant="caption"
                weight="bold"
                color="warningForeground"
                className="font-display-bold"
              >
                {initialsOf(name)}
              </Text>
            </View>
            <View className="flex-shrink">
              <Text variant="bodySm" weight="bold" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="label" color="highlight">
                {t("identity")}
              </Text>
            </View>
            <Icon icon={ChevronDown} size={16} color="mutedForeground" />
          </Pressable>
        </View>

        <View className="gap-1.5">
          <Text variant="labelLg" color="faintForeground">
            {t("eyebrow")}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t("title", { name })}
          </Text>
        </View>

        <ProfileCard profile={profile} />

        <View className="gap-2.5 rounded-3xl border border-border bg-surface p-4">
          <Text variant="label" color="faintForeground">
            {t("fills.title")}
          </Text>
          <View className="flex-row gap-2">
            {(["fighters", "sessions", "invitations"] as const).map((fill) =>
              fill === "sessions" ? (
                <View
                  key={fill}
                  accessible
                  accessibilityLabel={`${t("fills.sessions.label")}: ${t("fills.unavailable")}`}
                  className="flex-1 gap-1 rounded-2xl border border-border bg-background p-2.5"
                >
                  <Text
                    variant="label"
                    color="faintForeground"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {t("fills.sessions.label")}
                  </Text>
                  <Text variant="title" color="faintForeground">
                    {t("profile.none")}
                  </Text>
                </View>
              ) : (
                <Pressable
                  key={fill}
                  accessibilityRole="link"
                  accessibilityLabel={`${t(`fills.${fill}.label`)}: ${t("fills.open")}`}
                  onPress={() =>
                    router.push(routeHref("mobile.coach.fighters", {}, OPEN_FILLS[fill]))
                  }
                  className="flex-1 gap-1 rounded-2xl border border-accent-border bg-background p-2.5 active:bg-muted"
                >
                  <Text
                    variant="label"
                    color="highlight"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {t(`fills.${fill}.label`)}
                  </Text>
                  <Text variant="bodySm" weight="extrabold">
                    {t("fills.open")}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          <Text variant="caption" color="mutedForeground">
            {t("fills.note")}
          </Text>
        </View>

        <View className="gap-1 rounded-3xl border border-input bg-surface px-4 pb-1.5 pt-4">
          <Text variant="label" color="highlight">
            {t("setup.eyebrow")}
          </Text>
          <Text variant="h3" accessibilityRole="header" className="pb-1.5">
            {t("setup.title")}
          </Text>
          <View
            accessible
            accessibilityLabel={`${t("setup.profile.title")}, ${t("setup.done")}`}
            className="min-h-14 flex-row items-center gap-3 border-t border-border py-1.5"
          >
            <View className="size-6.5 items-center justify-center rounded-full bg-primary">
              <Icon icon={Check} size={15} color="primaryForeground" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="extrabold">
                {t("setup.profile.title")}
              </Text>
              <Text variant="caption" color="faintForeground">
                {t("setup.profile.line")}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${t("setup.invite.title")}, ${t("setup.invite.line")}`}
            onPress={() => router.push(routeHref("mobile.coach.fighters"))}
            className="min-h-14 flex-row items-center gap-3 border-t border-border py-1.5 active:bg-muted"
          >
            <View className="size-6.5 rounded-full border-2 border-primary-muted" />
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="extrabold">
                {t("setup.invite.title")}
              </Text>
              <Text variant="caption" color="faintForeground">
                {t("setup.invite.line")}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={16} color="faintForeground" />
          </Pressable>
          {LATER_STEPS.map((step) => (
            <View
              key={step}
              accessible
              accessibilityLabel={`${t(`setup.${step}.title`)}, ${t("setup.unavailable")}`}
              className="min-h-14 flex-row items-center gap-3 border-t border-border py-1.5"
            >
              <View className="size-6.5 rounded-full border-2 border-dashed border-accent-border" />
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="extrabold" color="mutedForeground">
                  {t(`setup.${step}.title`)}
                </Text>
                <Text variant="caption" color="faintForeground">
                  {t("setup.unavailable")}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Notice tone="muted" icon={Info}>
          {`${t("note.title")} ${t("note.body")}`}
        </Notice>
      </ScrollView>
      <ContextSwitcherSheet
        visible={switching}
        current="coach"
        onClose={() => setSwitching(false)}
      />
    </View>
  );
}

/** The saved CoachProfile, as OC11 and the web WC1 show it. */
function ProfileCard({ profile }: { profile: CoachProfile }) {
  const t = useTranslations("coachHome.profile");
  const type = useTranslations("coachOnboarding.type");
  const languages = useTranslations("coachOnboarding.profile.languages.options");
  const locale = useLocale();
  const name = profile.display_name ?? "";
  const place = [
    profile.city,
    profile.country_code === null ? null : countryName(profile.country_code, locale),
  ]
    .filter(Boolean)
    .join(", ");
  const line = [profile.brand_name, place].filter(Boolean).join(" · ");
  const list = (items: string[]) => (items.length === 0 ? t("none") : items.join(" · "));
  const rows: [string, string][] = [
    [
      t("formats"),
      list(profile.coaching_formats.map((format) => type(`formats.options.${format}.label`))),
    ],
    [
      t("competition"),
      list(profile.competition_levels.map((level) => type(`levels.options.${level}`))),
    ],
    [t("languages"), list(profile.languages.map((language) => languages(language)))],
    [t("bio"), profile.bio ?? t("none")],
  ];

  return (
    <View className="gap-3 rounded-3xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="label" color="faintForeground">
          {t("title")}
        </Text>
        <Text variant="badge" color="accentForeground" className="rounded-sm bg-accent px-2.5 py-1">
          {t("complete")}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Avatar name={name} />
        <View className="flex-1 gap-0.5">
          <Text variant="bodyLg" weight="extrabold" numberOfLines={2}>
            {name}
          </Text>
          {line === "" ? null : (
            <Text variant="caption" color="mutedForeground">
              {line}
            </Text>
          )}
        </View>
      </View>
      <View>
        {rows.map(([label, value]) => (
          <View
            key={label}
            accessible
            accessibilityLabel={`${label}: ${value}`}
            className="gap-0.5 border-t border-border py-2.5"
          >
            <Text variant="caption" weight="bold" color="faintForeground">
              {label}
            </Text>
            <Text variant="bodySm" weight="bold">
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
