import { useNavigation, useRouter } from "expo-router";
import { Check, CircleAlert, ShieldCheck } from "lucide-react-native";
import { useLayoutEffect } from "react";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { isUnavailable, useMyCoach, type MyCoach } from "@/entities/coach-relationship";
import { EndRelationshipButton, type EndOutcome } from "@/features/fighter-coach-relationship-end";
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

import { coachName } from "./my-coaches-screen";

/*
 * FC2 Coach relationship (`mobile.profile.coaches._relationship-id`, SF-59;
 * Claude Design FighterCoaches screen=detail, version 1792069267-b198).
 *
 * One active relationship, verified against the backend on every entry (the
 * id must be in the fighter's active list; the route parameter authorizes
 * nothing). It shows the coach's public identity, what that coach sees
 * (the disclosed fields) and what is never shared, and ends the
 * relationship after confirmation. An ended, foreign or unknown id is one
 * not-available state, with no detail of which.
 */

const NEVER = ["body", "account", "others"] as const;

export function CoachRelationshipScreen({ relationshipId }: { relationshipId: string }) {
  const t = useTranslations("fighterCoaches");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const relationship = useMyCoach(relationshipId);
  const title = titles("mobile/profile/coaches/_relationship-id");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  if (relationship.isError && !isUnavailable(relationship.error)) {
    return (
      <Screen>
        <View className="gap-3" testID="fighter-coach:failed">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("failed.title")} ${t("failed.body")}`}
          </Notice>
          <Button
            label={t("failed.retry")}
            variant="quiet"
            onPress={() => void relationship.refetch()}
          />
        </View>
      </Screen>
    );
  }
  if (relationship.isPending) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner label={t("detail.loading")} />
        </View>
      </Screen>
    );
  }
  if (relationship.isError || relationship.data === null) return <NotAvailable />;
  return <Relationship coach={relationship.data} />;
}

function NotAvailable() {
  const t = useTranslations("fighterCoaches.detail.unavailable");
  const router = useRouter();
  return (
    <Screen>
      <View
        accessible
        accessibilityRole="summary"
        className="gap-2.5 rounded-3xl border border-border bg-surface p-5"
        testID="fighter-coach:unavailable"
      >
        <Text variant="h3">{t("title")}</Text>
        <Text color="mutedForeground">{t("body")}</Text>
      </View>
      <Button
        label={t("back")}
        variant="quiet"
        onPress={() => router.replace(routeHref("mobile.profile.coaches"))}
      />
    </Screen>
  );
}

function Relationship({ coach }: { coach: MyCoach }) {
  const t = useTranslations("fighterCoaches");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const name = coachName(coach.coach, t("fallbackName"));
  const brand = coach.coach?.display_name ? coach.coach.brand_name : null;

  const done = (outcome: EndOutcome) => {
    // Only the backend's confirmation names the coach; a relationship that
    // is no longer reachable says nothing about who or why.
    if (outcome === "ended") toast.show({ title: t("end.ended", { name }), tone: "success" });
    else toast.show({ title: t("end.unavailable") });
    if (router.canGoBack()) router.back();
    else router.replace(routeHref("mobile.profile.coaches"));
  };

  return (
    <Screen>
      <View className="flex-row items-center gap-3.5" testID="fighter-coach:ready">
        <Avatar name={name} size="lg" />
        <View className="flex-1 gap-1">
          <Text variant="h2" accessibilityRole="header">
            {name}
          </Text>
          {brand ? <Text color="mutedForeground">{brand}</Text> : null}
          <View className="flex-row">
            <Badge
              label={t("detail.active", {
                date: format.dateTime(new Date(coach.started_at), "date"),
              })}
            />
          </View>
        </View>
      </View>

      <View className="rounded-3xl border border-border bg-surface px-4 pb-1 pt-3.5">
        <Text variant="label" color="faintForeground" accessibilityRole="header" className="pb-1.5">
          {t("detail.sees", { name })}
        </Text>
        {coach.disclosed_fields.length === 0 ? (
          <Text color="mutedForeground" className="border-t border-border py-3">
            {t("detail.nothing")}
          </Text>
        ) : (
          coach.disclosed_fields.map((field) => (
            <View
              key={field}
              className="min-h-11 flex-row items-center gap-2.5 border-t border-border py-2"
            >
              <Icon icon={Check} size={16} color="highlight" />
              <Text variant="body" weight="bold">
                {t(`detail.fields.${field}`)}
              </Text>
            </View>
          ))
        )}
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

      <EndRelationshipButton
        relationshipId={coach.relationship_id}
        coachName={name}
        onDone={done}
      />
    </Screen>
  );
}
