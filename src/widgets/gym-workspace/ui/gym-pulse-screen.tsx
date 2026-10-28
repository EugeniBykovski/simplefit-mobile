import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, CircleAlert, Clock, SlidersHorizontal } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { primaryLocation, type Gym } from "@/entities/gym";
import { useGymSetup, type GymSetup } from "@/entities/gym-setup";
import { ContextSwitcherSheet, gymTarget } from "@/features/session-gate";
import { GymSetupAccentColor } from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";
import { countryName } from "@/shared/lib/countries";
import { routeHref } from "@/shared/routes/routes";
import { rawPalette } from "@/shared/styles/tokens";
import { initialsOf } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { useGymWorkspace } from "./gym-gate";

/*
 * G01 Gym pulse (`mobile.gyms._gym-id.pulse`, SF-89; Claude Design GymPulse,
 * version 1792675284-1046, 390 pt), the GYM_WORKSPACE home of the gym in the
 * route, reduced to real data (D-MOBILE-GYM-SHELL-MVP):
 *
 * - the identity pill (gym name and the viewer's role, from
 *   `GET /api/v1/gyms/{gym_id}`) opens A04, "One account, every role", with
 *   the account's profiles and gyms and this gym checked;
 * - the header's Incidents and Announcements (no domain yet) give way to
 *   Settings, the shared ST1 with the account and Sign out;
 * - OG1's "How members see you" card: name, type and primary location; for
 *   the owner the saved setup (`GET /api/v1/gyms/{gym_id}/setup`), for other
 *   roles a limited-access notice; the viewer's access; the areas coming
 *   later.
 *
 * Location chips, QR check-in, the KPI tiles and today's classes are hidden
 * until their domains exist, never shown as zero (SF-82 R5/C7). GR1/GR2
 * (first run) stay with SF-101.
 */

/** The OG3 swatch names in `gymOnboarding`, in the contract's order of `accent_color` (as SF-87). */
const ACCENT_NAMES = ["olive", "amber", "coral", "sky", "bone", "moss"] as const;
const ACCENT_COLORS: readonly (string | null)[] = Object.values(GymSetupAccentColor);
const accentName = (color: string) => ACCENT_NAMES[ACCENT_COLORS.indexOf(color)];

/** Ink on a chosen swatch (the OG3 contrast rule): always graphite. */
const INK = rawPalette.graphite950;

/** The gym areas whose domains do not exist yet: listed as coming later, never as numbers. */
const LATER = ["members", "schedule", "attendance", "staff"] as const;

export function GymPulseScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const gym = useGymWorkspace(gymId);
  // The gym gate covers this screen until it has this gym's answer.
  if (gym === undefined) return null;
  return <GymPulseView gym={gym} />;
}

export function GymPulseView({ gym }: { gym: Gym }) {
  const t = useTranslations("gymShell");
  const format = useFormatter();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [switching, setSwitching] = useState(false);
  const owner = gym.viewer.role === "owner";
  const setup = useGymSetup(owner ? gym.id : null);
  const saved = setup.data?.gym_id === gym.id ? setup.data : undefined;
  const location = primaryLocation(gym);
  const where =
    gym.locations.length === 1 && location !== null ? location.name : t("pulse.allLocations");
  const today = format.dateTime(new Date(), { weekday: "short", month: "short", day: "numeric" });
  const role = t(`roles.${gym.viewer.role}`);

  return (
    // Runtime inset: content scrolls below the status bar, never under it.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-6 pt-3">
        <View className="flex-row items-center justify-between gap-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("identity", { name: gym.name, role })}
            onPress={() => setSwitching(true)}
            className="min-h-11 flex-shrink flex-row items-center gap-2.5 rounded-full border border-border bg-surface py-1 pl-1 pr-3.5"
          >
            <GymTile name={gym.name} accent={saved?.accent_color ?? null} size="sm" />
            <View className="flex-shrink">
              <Text variant="bodySm" weight="bold" numberOfLines={1}>
                {gym.name}
              </Text>
              <Text variant="label" color="highlight" numberOfLines={1}>
                {role}
              </Text>
            </View>
            <Icon icon={ChevronDown} size={16} color="mutedForeground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings")}
            onPress={() => router.push(routeHref("mobile.settings"))}
            className="size-11 items-center justify-center rounded-full border border-border bg-surface"
          >
            <Icon icon={SlidersHorizontal} size={18} />
          </Pressable>
        </View>

        <View className="gap-1">
          <Text variant="label" color="faintForeground" numberOfLines={2}>
            {t("pulse.eyebrow", { date: today, where })}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t("pulse.title")}
          </Text>
        </View>

        <Card
          title={t("pulse.summary.title")}
          aside={<Badge variant="accent" label={t("pulse.summary.completed")} />}
        >
          <Summary gym={gym} accent={saved?.accent_color ?? null} />
        </Card>
        {owner ? (
          <Card title={t("pulse.details.title")}>
            <Details
              setup={saved}
              failed={setup.isError}
              restricted={setup.isError && isApiError(setup.error) && setup.error.status === 403}
              onRetry={() => void setup.refetch()}
            />
          </Card>
        ) : (
          <Card title={t("pulse.limited.title")}>
            <Notice tone="amber" icon={CircleAlert}>
              {t("pulse.limited.body", { role })}
            </Notice>
          </Card>
        )}
        <Card title={t("pulse.access.title")}>
          <View className="gap-1">
            <Text variant="title" weight="extrabold">
              {role}
            </Text>
            <Text variant="bodySm" color="mutedForeground">
              {t(`pulse.access.roles.${gym.viewer.role}`)}
            </Text>
          </View>
          <Text variant="caption" color="faintForeground">
            {t("pulse.access.note")}
          </Text>
        </Card>
        <Card title={t("pulse.later.title")}>
          <View>
            {LATER.map((area, index) => (
              <View
                key={area}
                accessible
                accessibilityLabel={`${t(`pulse.later.${area}.title`)}, ${t(`pulse.later.${area}.body`)}, ${t("pulse.later.badge")}`}
                className={`min-h-14 flex-row items-center gap-3 py-2 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <Icon icon={Clock} size={16} color="faintForeground" />
                <View className="flex-1 gap-0.5">
                  <Text variant="bodySm" weight="extrabold">
                    {t(`pulse.later.${area}.title`)}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {t(`pulse.later.${area}.body`)}
                  </Text>
                </View>
                <Badge variant="neutral" label={t("pulse.later.badge")} />
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
      <ContextSwitcherSheet
        visible={switching}
        current={gymTarget(gym.id)}
        onClose={() => setSwitching(false)}
      />
    </View>
  );
}

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3.5 rounded-3xl border border-border bg-surface px-4 py-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="label"
          color="faintForeground"
          accessibilityRole="header"
          className="flex-shrink"
        >
          {title}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** The gym's initials on its accent colour once the owner's setup is read, otherwise olive. */
function GymTile({
  name,
  accent,
  size,
}: {
  name: string;
  accent: string | null;
  size: "sm" | "lg";
}) {
  return (
    <View
      className={`items-center justify-center ${size === "sm" ? "size-9 rounded-xl" : "size-14 rounded-2xl"} ${accent === null ? "bg-primary" : ""}`}
      // Runtime data: the gym's saved accent colour.
      style={accent === null ? undefined : { backgroundColor: accent }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        variant={size === "sm" ? "caption" : "body"}
        weight="bold"
        color="primaryForeground"
        className="font-display-bold"
        maxFontSizeMultiplier={1}
        // Runtime: on a chosen swatch the ink is always graphite.
        style={accent === null ? undefined : { color: INK }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

/** OG1's "How members see you": the real name, type and primary location. */
function Summary({ gym, accent }: { gym: Gym; accent: string | null }) {
  const types = useTranslations("gymOnboarding.gymTypes");
  const locale = useLocale();
  const location = primaryLocation(gym);
  const place =
    location === null
      ? null
      : [location.city, countryName(location.country_code, locale)].join(", ");
  return (
    <View className="flex-row items-center gap-3.5">
      <GymTile name={gym.name} accent={accent} size="lg" />
      <View className="flex-1 gap-0.5">
        <Text variant="title" className="font-display">
          {gym.name}
        </Text>
        <Text variant="bodySm" color="mutedForeground">
          {[types(gym.gym_type), place].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

/**
 * The owner's saved setup: its own read, so a failure here (offline, 5xx,
 * 403) keeps the summary and the access card on screen with a retry.
 */
function Details({
  setup,
  failed,
  restricted,
  onRetry,
}: {
  setup: GymSetup | undefined;
  failed: boolean;
  restricted: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("gymShell.pulse.details");
  const colors = useTranslations("gymOnboarding.branding.accent.colors");
  const locale = useLocale();

  if (setup === undefined) {
    if (failed) {
      return (
        <View className="gap-2.5" accessibilityRole="alert">
          <Notice tone="amber" icon={CircleAlert}>
            {restricted ? t("restricted") : t("failed")}
          </Notice>
          {restricted ? null : <Button label={t("retry")} variant="quiet" onPress={onRetry} />}
        </View>
      );
    }
    return (
      <View className="gap-2" accessible accessibilityLabel={t("loading")}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </View>
    );
  }

  const location = setup.primary_location;
  const accent = setup.accent_color === null ? undefined : accentName(setup.accent_color);
  const rows: [string, string | null, string | null][] = [
    [
      t("address"),
      location === null
        ? null
        : [
            location.address_line,
            `${location.city}, ${countryName(location.country_code, locale)}`,
            location.entrance_note,
          ]
            .filter(Boolean)
            .join("\n"),
      null,
    ],
    [t("phone"), setup.phone, null],
    [t("website"), setup.website, null],
    [t("tagline"), setup.tagline, null],
    [t("accent"), accent === undefined ? null : colors(accent), setup.accent_color],
  ];

  return (
    <View>
      {rows.map(([label, value, swatch]) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${label}: ${value ?? t("none")}`}
          className="min-h-12 gap-1 border-t border-border py-2"
        >
          <Text variant="caption" weight="bold" color="faintForeground">
            {label}
          </Text>
          <View className="flex-row items-center gap-2">
            {swatch !== null && value !== null ? (
              <View
                className="size-4 rounded-full border border-border"
                // Runtime data: the gym's saved accent colour.
                style={{ backgroundColor: swatch }}
              />
            ) : null}
            <Text
              variant="bodySm"
              weight="bold"
              color={value === null ? "faintForeground" : undefined}
              className="flex-shrink"
            >
              {value ?? t("none")}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
