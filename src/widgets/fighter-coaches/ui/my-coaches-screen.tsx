import { useNavigation, useRouter } from "expo-router";
import { ChevronRight, CircleAlert, Lock, Mail, UserRound } from "lucide-react-native";
import { useLayoutEffect } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";

import {
  isUnavailable,
  useMyCoaches,
  type MyCoach,
  type MyCoachStatus,
} from "@/entities/coach-relationship";
import { routeHref } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

/*
 * FC1 My coaches (`mobile.profile.coaches`, SF-59; Claude Design
 * FighterCoaches, version 1792069267-b198, 390 pt), pushed from the Profile
 * tab (F18).
 *
 * The fighter's real coaching relationships from `listMyCoaches` (SF-56):
 * Active (default) and Ended (`?view=ended`). Active rows show each coach's
 * public identity and start and open FC2; ended rows show only the coach's
 * name at the end, the date and who ended it, and open nothing. Loading,
 * an empty list, unavailable (`404`: no completed fighter profile) and a
 * failure are four different states. The Invitations row opens FCI1, the
 * incoming coach invitations (SF-76).
 */

export function MyCoachesScreen({ view }: { view: MyCoachStatus }) {
  const t = useTranslations("fighterCoaches");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useMyCoaches(view);
  const title = titles("mobile/profile/coaches");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const rows = list.data?.pages.flatMap((page) => page.relationships) ?? [];

  const header = (
    <View className="gap-4 pb-1">
      <Text color="mutedForeground">{t("intro")}</Text>
      <InvitationsEntry />
      <SegmentedControl
        label={t("views")}
        value={view}
        segments={[
          { value: "active", label: t("tabs.active") },
          { value: "ended", label: t("tabs.ended") },
        ]}
        onChange={(next) =>
          router.replace(
            routeHref("mobile.profile.coaches", {}, next === "ended" ? { view: "ended" } : {}),
          )
        }
      />
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-2.5 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      data={list.isSuccess ? rows : []}
      keyExtractor={(item) => item.relationship_id}
      ListHeaderComponent={header}
      renderItem={({ item }) =>
        view === "active" ? <ActiveRow coach={item} /> : <EndedRow coach={item} />
      }
      ListEmptyComponent={<ListState view={view} list={list} />}
      ListFooterComponent={
        list.isSuccess && rows.length > 0 ? (
          <View className="gap-3 pt-1">
            {list.hasNextPage ? (
              <Button
                label={list.isFetchingNextPage ? t("loadingMore") : t("more")}
                variant="quiet"
                loading={list.isFetchingNextPage}
                disabled={list.isFetchingNextPage}
                onPress={() => void list.fetchNextPage()}
              />
            ) : null}
            {view === "ended" ? (
              <Text variant="caption" color="faintForeground">
                {t("endedNote")}
              </Text>
            ) : null}
          </View>
        ) : null
      }
    />
  );
}

function ListState({ view, list }: { view: MyCoachStatus; list: ReturnType<typeof useMyCoaches> }) {
  const t = useTranslations("fighterCoaches");

  if (list.isError && isUnavailable(list.error)) {
    return (
      <Message
        icon={Lock}
        title={t("unavailable.title")}
        body={t("unavailable.body")}
        testID="fighter-coaches:unavailable"
      />
    );
  }
  if (list.isError) {
    return (
      <View className="gap-3" testID="fighter-coaches:failed">
        <Notice tone="coral" icon={CircleAlert}>
          {`${t("failed.title")} ${t("failed.body")}`}
        </Notice>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void list.refetch()} />
      </View>
    );
  }
  if (list.data === undefined) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("loading")}
        className="gap-2.5"
        testID="fighter-coaches:loading"
      >
        <Skeleton className="h-19 rounded-3xl" />
        <Skeleton className="h-19 rounded-3xl" />
      </View>
    );
  }
  return (
    <Message
      icon={UserRound}
      title={t(`empty.${view}.title`)}
      body={t(`empty.${view}.body`)}
      testID="fighter-coaches:empty"
    />
  );
}

function Message({
  icon,
  title,
  body,
  testID,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  testID: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="summary"
      className="items-start gap-2.5 rounded-3xl border border-border bg-surface p-5"
      testID={testID}
    >
      <View className="size-11 items-center justify-center rounded-2xl bg-accent">
        <Icon icon={icon} color="highlight" />
      </View>
      <Text variant="h3">{title}</Text>
      <Text color="mutedForeground">{body}</Text>
    </View>
  );
}

/** FC1's entry to FCI1, the incoming coach invitations (SF-76). */
function InvitationsEntry() {
  const t = useTranslations("fighterCoaches.invitations");
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t("title")}, ${t("body")}`}
      accessibilityHint={t("open")}
      onPress={() => router.push(routeHref("mobile.profile.coaches.invitations"))}
      className="min-h-14 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-3.5 py-2 active:bg-muted"
      testID="fighter-coaches:invitations"
    >
      <View className="size-9 items-center justify-center rounded-xl bg-accent">
        <Icon icon={Mail} size={18} color="highlight" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="bodySm" weight="extrabold">
          {t("title")}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {t("body")}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={16} color="faintForeground" />
    </Pressable>
  );
}

/** The coach's name as the fighter sees it: display name, else brand. */
export function coachName(coach: MyCoach["coach"], fallback: string): string {
  return coach?.display_name ?? coach?.brand_name ?? fallback;
}

function ActiveRow({ coach }: { coach: MyCoach }) {
  const t = useTranslations("fighterCoaches");
  const format = useFormatter();
  const router = useRouter();
  const name = coachName(coach.coach, t("fallbackName"));
  const since = format.dateTime(new Date(coach.started_at), "date");
  const brand = coach.coach?.display_name ? coach.coach.brand_name : null;
  const line = brand
    ? t("row.brandSince", { brand, date: since })
    : t("row.since", { date: since });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${line}`}
      accessibilityHint={t("row.open")}
      onPress={() =>
        router.push(
          routeHref("mobile.profile.coaches._relationship-id", {
            relationshipId: coach.relationship_id,
          }),
        )
      }
      className="min-h-19 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-3.5 py-3 active:bg-muted"
    >
      <Avatar name={name} />
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="mutedForeground" numberOfLines={2}>
          {line}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={16} color="faintForeground" />
    </Pressable>
  );
}

/** An ended relationship: the coach's name at the end, the date and who ended it (FC1). */
export function EndedRow({ coach }: { coach: MyCoach }) {
  const t = useTranslations("fighterCoaches");
  const format = useFormatter();
  const name = coach.coach_display_name_at_end ?? t("fallbackName");
  const date = coach.ended_at ? format.dateTime(new Date(coach.ended_at), "date") : "";
  const line = t("row.ended", {
    date,
    by: coach.ended_by === "coach" ? t("row.endedBy.coach") : t("row.endedBy.fighter"),
  });

  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${line}`}
      className="min-h-17 flex-row items-center gap-3 rounded-3xl border border-border bg-background px-3.5 py-3"
    >
      <Avatar name={name} size="sm" />
      <View className="flex-1 gap-0.5">
        <Text variant="bodySm" weight="extrabold" color="mutedForeground" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="faintForeground">
          {line}
        </Text>
      </View>
    </View>
  );
}
