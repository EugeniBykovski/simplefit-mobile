import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight, CircleAlert, Lock } from "lucide-react-native";
import { Pressable, SectionList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";

import {
  isUnavailable,
  useMyTrainingSessions,
  type MyTrainingSession,
  type TrainingSessionFilter,
  type TrainingSessionView,
  useCoachLine,
  zoneCity,
} from "@/entities/training-session";
import { pickerValue, wallTimeOf } from "@/shared/lib/time-zone";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { Message, StatusBadge } from "./parts";

/*
 * FT1 Training (`mobile.training`, SF-66; Claude Design TrainingHub.dc.html
 * screen=list, version 1792569354-73b2, 390 pt), the Fighter app's Training
 * tab.
 *
 * The backend's own projections of the fighter's assigned sessions (SF-63,
 * `listMyTrainingSessions`): Upcoming, and History (`?view=history`)
 * narrowed to Completed or Cancelled (`?status=`), from every coach, also
 * after a relationship ended. Order, buckets and statuses are the server's;
 * a past-due planned session stays Planned. Rows are grouped by the day of
 * each session in its own time zone. Loading, empty, not available (`404`:
 * no completed fighter profile) and failure are separate states. No timer,
 * log, score or count: those domains do not exist (F24 hub is FUTURE).
 */

const VIEWS: readonly TrainingSessionView[] = ["upcoming", "history"];
const FILTERS: readonly TrainingSessionFilter[] = ["all", "completed", "cancelled"];

export function FighterTrainingScreen({
  view,
  filter,
}: {
  view: TrainingSessionView;
  filter: TrainingSessionFilter;
}) {
  const t = useTranslations("fighterTraining");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useMyTrainingSessions(view, view === "history" ? filter : "all");
  const bottom = insets.bottom + 112;
  const sections = useSections(list.data?.pages.flatMap((page) => page.training_sessions) ?? []);
  const go = (next: TrainingSessionView, nextFilter: TrainingSessionFilter) =>
    router.replace(
      routeHref(
        "mobile.training",
        {},
        next === "upcoming"
          ? {}
          : nextFilter === "all"
            ? { view: next }
            : { view: next, status: nextFilter },
      ),
    );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="gap-3.5 px-5 pb-3 pt-3">
        <Text
          variant="h1"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {t("title")}
        </Text>
        <SegmentedControl
          label={t("list.views")}
          value={view}
          segments={VIEWS.map((value) => ({ value, label: t(`list.tabs.${value}`) }))}
          onChange={(next) => go(next, "all")}
        />
        {view === "history" ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t("list.filter")}
            className="flex-row flex-wrap gap-2"
          >
            {FILTERS.map((option) => (
              <Chip
                key={option}
                label={t(`list.filters.${option}`)}
                checked={filter === option}
                onPress={() => go("history", option)}
              />
            ))}
          </View>
        ) : null}
      </View>
      <SectionList
        className="flex-1"
        contentContainerClassName="gap-2 px-5"
        contentContainerStyle={{ paddingBottom: bottom }}
        sections={list.isSuccess ? sections : []}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text
            variant="label"
            color="faintForeground"
            accessibilityRole="header"
            className="pb-0.5 pt-2"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <SessionRow
            session={item}
            onPress={() =>
              router.push(routeHref("mobile.sessions._session-id", { sessionId: item.id }))
            }
          />
        )}
        ListEmptyComponent={<ListState view={view} filter={filter} query={list} />}
        ListFooterComponent={
          list.isSuccess && sections.length > 0 ? (
            <View className="gap-3 pt-2">
              {list.isFetchNextPageError ? (
                <View accessibilityRole="alert">
                  <Notice tone="coral" icon={CircleAlert}>
                    {t("failed.more")}
                  </Notice>
                </View>
              ) : null}
              {list.hasNextPage ? (
                <Button
                  label={list.isFetchingNextPage ? t("list.loadingMore") : t("list.more")}
                  variant="quiet"
                  loading={list.isFetchingNextPage}
                  disabled={list.isFetchingNextPage}
                  onPress={() => void list.fetchNextPage()}
                />
              ) : null}
              <Text variant="caption" color="faintForeground">
                {t("list.note")}
              </Text>
            </View>
          ) : null
        }
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void list.refetch()}
      />
    </View>
  );
}

/** Consecutive sessions on the same day of their own zone, in the server's order. */
function useSections(sessions: MyTrainingSession[]) {
  const format = useFormatter();
  const sections: { key: string; title: string; data: MyTrainingSession[] }[] = [];
  for (const session of sessions) {
    const day = wallTimeOf(new Date(session.starts_at), session.time_zone).date;
    const last = sections.at(-1);
    if (last?.key === day) last.data.push(session);
    else
      sections.push({
        key: day,
        title: format.dateTime(pickerValue(day, "12:00"), {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        data: [session],
      });
  }
  return sections;
}

function ListState({
  view,
  filter,
  query,
}: {
  view: TrainingSessionView;
  filter: TrainingSessionFilter;
  query: { isError: boolean; error: unknown; data: unknown; refetch: () => unknown };
}) {
  const t = useTranslations("fighterTraining");
  if (query.isError && isUnavailable(query.error)) {
    return (
      <Message
        icon={Lock}
        title={t("unavailable.title")}
        body={t("unavailable.body")}
        testID="training:unavailable"
      />
    );
  }
  if (query.isError) {
    return (
      <View className="gap-3" testID="training:failed">
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("failed.title")} ${t("failed.body")}`}
          </Notice>
        </View>
        <Button label={t("failed.retry")} variant="quiet" onPress={() => void query.refetch()} />
      </View>
    );
  }
  if (query.data === undefined) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("list.loading")}
        className="gap-2"
        testID="training:loading"
      >
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-19 rounded-3xl" />
        <Skeleton className="h-19 rounded-3xl" />
      </View>
    );
  }
  const key = view === "upcoming" ? "upcoming" : filter === "all" ? "history" : filter;
  return (
    <Message
      icon={CalendarDays}
      title={t(`empty.${key}.title`)}
      body={t(`empty.${key}.body`)}
      testID="training:empty"
    />
  );
}

function SessionRow({ session, onPress }: { session: MyTrainingSession; onPress: () => void }) {
  const t = useTranslations("fighterTraining");
  const format = useFormatter();
  const coachLine = useCoachLine();
  const time = format.dateTime(new Date(session.starts_at), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: session.time_zone,
  });
  const city = zoneCity(session.time_zone);
  const line = [
    t(`types.${session.training_type}`),
    coachLine(session).line,
    t("list.minutes", { minutes: session.duration_minutes }),
  ].join(" · ");
  const cancelled = session.status === "cancelled";
  const titleColor = cancelled ? "mutedForeground" : "foreground";
  // From accessibility text sizes on, the columns of a row leave the title
  // and the zone too little width (SF-65 native QA).
  const stacked = useWindowDimensions().fontScale >= 1.3;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        session.title,
        `${time} ${session.time_zone}`,
        line,
        t(`status.${session.status}`),
      ].join(", ")}
      accessibilityHint={t("list.open")}
      onPress={onPress}
      className="flex-row gap-3 rounded-3xl border border-border bg-surface px-3.5 py-3 active:bg-muted"
      testID={`training:row:${session.id}`}
    >
      {stacked ? (
        <View className="flex-1 gap-1.5">
          <Text variant="label" color={cancelled ? "faintForeground" : "mutedForeground"}>
            {`${time} · ${city}`}
          </Text>
          <Text variant="body" weight="extrabold" color={titleColor}>
            {session.title}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {line}
          </Text>
          <StatusBadge status={session.status} />
        </View>
      ) : (
        <>
          <View className="w-16 gap-0.5">
            <Text
              variant="title"
              color={cancelled ? "faintForeground" : "foreground"}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {time}
            </Text>
            <Text variant="label" color="faintForeground" numberOfLines={2}>
              {city}
            </Text>
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text variant="body" weight="extrabold" color={titleColor} className="flex-shrink">
                {session.title}
              </Text>
              <StatusBadge status={session.status} />
            </View>
            <Text variant="caption" color="mutedForeground">
              {line}
            </Text>
          </View>
        </>
      )}
      <View className="justify-center">
        <Icon icon={ChevronRight} size={16} color="faintForeground" />
      </View>
    </Pressable>
  );
}
