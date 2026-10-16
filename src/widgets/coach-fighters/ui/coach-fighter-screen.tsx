import { useNavigation, useRouter } from "expo-router";
import { CircleAlert, Info, ShieldCheck } from "lucide-react-native";
import { useLayoutEffect } from "react";
import { View } from "react-native";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { isUnavailable, useCoachFighter, type DisclosedField } from "@/entities/coach-fighter";
import { EndFighterButton, type EndOutcome } from "@/features/coach-fighter-end";
import { countryName } from "@/shared/lib/countries";
import { routeHref } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";

/*
 * C04 Fighter (`mobile.coach.fighters._fighter-id`, SF-61; Claude Design
 * FighterQuick, version 1792155768-3179). The segment is the SF-56
 * relationship id; `getMyCoachFighter` decides whether it is this coach's
 * and still active. Shows only the C1+C2 fields the fighter disclosed ("Not
 * shared" for the rest), what is never shared, and End relationship. Ended,
 * foreign or unknown ids and sharing off are one not-available state.
 * Sessions and notes are not offered: their domain does not exist yet.
 */

const FIELDS: readonly DisclosedField[] = [
  "display_name",
  "username",
  "country_code",
  "city",
  "experience_level",
  "stance",
  "amateur_bout_count",
];
const NEVER = ["body", "account", "others"] as const;

export function CoachFighterScreen({ relationshipId }: { relationshipId: string }) {
  const t = useTranslations("coachFighters");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const query = useCoachFighter(relationshipId);
  const title = titles("mobile/coach/fighters/_fighter-id");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  if (query.isError && !isUnavailable(query.error)) {
    return (
      <Screen>
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("failed.title")} ${t("failed.body")}`}
          </Notice>
        </View>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void query.refetch()} />
      </Screen>
    );
  }
  if (query.isError) return <NotAvailable />;
  if (query.data === undefined) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner label={t("detail.loading")} />
        </View>
      </Screen>
    );
  }
  return <Detail relationship={query.data} />;
}

function NotAvailable() {
  const t = useTranslations("coachFighters.detail.unavailable");
  const router = useRouter();
  return (
    <Screen>
      <View
        accessible
        accessibilityRole="summary"
        className="gap-2.5 rounded-3xl border border-border bg-surface p-5"
        testID="coach-fighter:unavailable"
      >
        <Text variant="h3">{t("title")}</Text>
        <Text color="mutedForeground">{t("body")}</Text>
      </View>
      <Button
        label={t("back")}
        variant="quiet"
        onPress={() => router.replace(routeHref("mobile.coach.fighters"))}
      />
    </Screen>
  );
}

function Detail({
  relationship,
}: {
  relationship: NonNullable<ReturnType<typeof useCoachFighter>["data"]>;
}) {
  const t = useTranslations("coachFighters");
  const levels = useTranslations("fighterOnboarding.experience.levels");
  const stances = useTranslations("fighterOnboarding.experience.stances");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const fighter = relationship.fighter;
  const name = fighter?.display_name ?? t("fallbackName");
  const disclosed = new Set(relationship.disclosed_fields);

  const value = (field: DisclosedField): string | null => {
    if (!disclosed.has(field) || fighter === null) return null;
    switch (field) {
      case "country_code":
        return fighter.country_code ? countryName(fighter.country_code, locale) : null;
      case "experience_level":
        return fighter.experience_level ? levels(`${fighter.experience_level}.title`) : null;
      case "stance":
        return fighter.stance ? stances(fighter.stance) : null;
      case "amateur_bout_count":
        return fighter.amateur_bout_count == null ? null : String(fighter.amateur_bout_count);
      case "username":
        return fighter.username ? `@${fighter.username}` : null;
      default:
        return fighter[field];
    }
  };
  const subline = [
    value("username"),
    [value("city"), value("country_code")].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const done = (outcome: EndOutcome) => {
    // Only the backend's 204 names the fighter; a relationship no longer
    // reachable says nothing about who or why.
    if (outcome === "ended") toast.show({ title: t("end.ended", { name }), tone: "success" });
    else toast.show({ title: t("end.unavailable") });
    if (router.canGoBack()) router.back();
    else router.replace(routeHref("mobile.coach.fighters"));
  };

  return (
    <Screen>
      <View className="flex-row items-center gap-3.5" testID="coach-fighter:ready">
        <Avatar name={name} size="lg" />
        <View className="flex-1 gap-1">
          <Text variant="h2" accessibilityRole="header">
            {name}
          </Text>
          {subline ? <Text color="mutedForeground">{subline}</Text> : null}
          <View className="flex-row">
            <Badge
              label={t("detail.active", {
                date: format.dateTime(new Date(relationship.started_at), "date"),
              })}
            />
          </View>
        </View>
      </View>

      <View className="rounded-3xl border border-border bg-surface px-4 pb-1 pt-3.5">
        <Text variant="label" color="faintForeground" accessibilityRole="header" className="pb-1.5">
          {t("detail.shares", { name })}
        </Text>
        {FIELDS.map((field) => {
          const shown = value(field);
          return (
            <View
              key={field}
              accessible
              accessibilityLabel={`${t(`detail.fields.${field}`)}: ${shown ?? t("notShared")}`}
              className="min-h-11 flex-row items-center justify-between gap-3 border-t border-border py-2.5"
            >
              <Text variant="bodySm" color="mutedForeground">
                {t(`detail.fields.${field}`)}
              </Text>
              <Text
                variant="bodySm"
                weight="extrabold"
                color={shown ? "foreground" : "faintForeground"}
                className="flex-shrink text-right"
              >
                {shown ?? t("notShared")}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="gap-2 rounded-3xl border border-border bg-surface p-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={ShieldCheck} size={16} color="faintForeground" />
          <Text variant="label" color="faintForeground" accessibilityRole="header">
            {t("detail.never.title")}
          </Text>
        </View>
        {NEVER.map((line) => (
          <Text key={line} variant="bodySm" color="mutedForeground">
            {t(`detail.never.${line}`)}
          </Text>
        ))}
      </View>

      <Notice tone="muted" icon={Info}>
        {t("detail.later")}
      </Notice>

      <EndFighterButton
        relationshipId={relationship.relationship_id}
        fighterName={name}
        onDone={done}
      />
    </Screen>
  );
}
