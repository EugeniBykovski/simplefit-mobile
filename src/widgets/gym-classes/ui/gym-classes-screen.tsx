import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";

import type { Gym } from "@/entities/gym";
import {
  addDays,
  deviceToday,
  printable,
  rosterCapabilities,
  useGymClassOccurrences,
  wallClock,
  wallDate,
  windowFor,
  type GymClassOccurrence,
  type RosterCapabilities,
} from "@/entities/gym-booking";
import { BookingProblemNotice, readProblem } from "@/features/gym-class-booking";
import { routeHref } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";
import { useGymWorkspace } from "@/widgets/gym-workspace";

type Range = "today" | "tomorrow" | "week";
const RANGES: readonly Range[] = ["today", "tomorrow", "week"];

/*
 * G08 Classes (`mobile.gyms._gym-id.classes`, SF-100; Claude Design
 * GymClasses, version 1793198527-a0fc, 390 pt, labelled FUTURE before the
 * SF-97/SF-99 domains existed): the classes of the gym in the route for
 * today, tomorrow or this week, every one a row of the SF-97 timetable
 * (never built from a weekly rule), at its own wall time in its venue's zone.
 *
 * Built: the eyebrow and title, the day filter and the class rows (time,
 * title, instructor · venue · duration, capacity as a limit). A class whose
 * roster the viewer's role may read opens G03 (owner, managers and front
 * desk any class; a coach the classes they teach). Not built (no contract):
 * location chips, booked counts such as 8/16, DONE / NEXT tags and FULL ·
 * WAITLIST (D-GYM-CLASS-ROSTER).
 */
export function GymClassesScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const gym = useGymWorkspace(gymId);
  if (gym === undefined) return null;
  return <GymClassesView key={gym.id} gym={gym} />;
}

export function GymClassesView({ gym }: { gym: Gym }) {
  const t = useTranslations("gymBooking.classes");
  const format = useFormatter();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = deviceToday();
  const [range, setRange] = useState<Range>("today");
  const [first, last] =
    range === "today"
      ? [today, today]
      : range === "tomorrow"
        ? [addDays(today, 1), addDays(today, 1)]
        : [today, addDays(today, 6)];
  const window = useMemo(() => windowFor(first, last), [first, last]);
  const list = useGymClassOccurrences(gym.id, window);
  const can = rosterCapabilities(gym.viewer);
  const shown = list.occurrences.filter((item) => {
    const date = wallDate(item.local_starts_at);
    return date >= first && date <= last;
  });
  const days = [...new Set(shown.map((item) => wallDate(item.local_starts_at)))];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerClassName="gap-4 px-5 pb-6 pt-3">
        <View className="gap-1">
          <Text variant="label" color="faintForeground" numberOfLines={2}>
            {t("eyebrow", {
              gym: gym.name,
              date: format.dateTime(printable(today), {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }),
            })}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {t("title")}
          </Text>
        </View>
        <SegmentedControl
          label={t("range")}
          segments={RANGES.map((value) => ({ value, label: t(`ranges.${value}`) }))}
          value={range}
          onChange={setRange}
        />
        {list.query.isError ? (
          <View className="gap-2">
            <BookingProblemNotice problem={readProblem(list.query.error)} />
            <Button
              variant="secondary"
              label={t("retry")}
              onPress={() => void list.query.refetch()}
            />
          </View>
        ) : !list.complete ? (
          <View
            accessible
            accessibilityLabel={t("loading")}
            accessibilityRole="progressbar"
            className="gap-2"
          >
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </View>
        ) : shown.length === 0 ? (
          <View className="rounded-3xl border border-dashed border-border px-4 py-8">
            <Text variant="bodySm" color="mutedForeground" className="text-center">
              {t(`empty.${range}`)}
            </Text>
          </View>
        ) : (
          days.map((date) => (
            <View key={date} className="gap-2">
              {range === "week" ? (
                <Text variant="label" color="faintForeground" accessibilityRole="header">
                  {format.dateTime(printable(date), {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </Text>
              ) : null}
              {shown
                .filter((item) => wallDate(item.local_starts_at) === date)
                .map((item) => (
                  <ClassRow
                    key={item.occurrence_id}
                    item={item}
                    can={can}
                    onOpen={() =>
                      router.push(
                        routeHref("mobile.gyms._gym-id.classes._class-id.roster", {
                          gymId: gym.id,
                          classId: item.occurrence_id,
                        }),
                      )
                    }
                  />
                ))}
            </View>
          ))
        )}
        {shown[0] ? (
          <Text variant="caption" color="faintForeground">
            {t("zone", { zone: shown[0].time_zone })}
          </Text>
        ) : null}
        <Text variant="caption" color="faintForeground">
          {can.canViewRoster({ instructor: null }) ? t("hint") : t("hintCoach")}
        </Text>
      </ScrollView>
    </View>
  );
}

function ClassRow({
  item,
  can,
  onOpen,
}: {
  item: GymClassOccurrence;
  can: RosterCapabilities;
  onOpen: () => void;
}) {
  const t = useTranslations("gymBooking.classes");
  const cancelled = item.status === "cancelled";
  const opens = can.canViewRoster(item);
  const line = [
    item.instructor?.name ?? t("noInstructor"),
    item.venue.name,
    t("minutes", { count: item.duration_minutes }),
  ].join(" · ");
  const body = (
    <>
      <Text variant="title" color={cancelled ? "faintForeground" : "foreground"} className="w-14">
        {wallClock(item.local_starts_at)}
      </Text>
      <View className="flex-1 gap-1">
        <Text variant="bodySm" weight="extrabold">
          {item.title}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {line}
        </Text>
        <Text variant="caption" color="faintForeground">
          {t("capacity", { count: item.capacity })}
        </Text>
      </View>
      {cancelled ? <Badge variant="destructive" label={t("cancelled")} /> : null}
      {opens ? <Icon icon={ChevronRight} size={18} color="faintForeground" /> : null}
    </>
  );
  const row = `min-h-16 flex-row items-center gap-3 rounded-3xl border px-3.5 py-3 ${cancelled ? "border-dashed border-border bg-background" : "border-border bg-surface"}`;
  return opens ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("open", { title: item.title, time: wallClock(item.local_starts_at) })}
      onPress={onOpen}
      testID={`gym-class-${item.occurrence_id}`}
      className={row}
    >
      {body}
    </Pressable>
  ) : (
    <View className={row} testID={`gym-class-${item.occurrence_id}`}>
      {body}
    </View>
  );
}
