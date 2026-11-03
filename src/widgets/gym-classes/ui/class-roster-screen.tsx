import { useLocalSearchParams, useNavigation } from "expo-router";
import { Check, Info } from "lucide-react-native";
import { useLayoutEffect, useState } from "react";
import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import type { Gym } from "@/entities/gym";
import {
  printable,
  rosterCapabilities,
  useClassRoster,
  useGymClassOccurrence,
  wallClock,
  wallDate,
  type GymClassOccurrence,
  type GymClassRosterEntry,
  type GymClassRosterView,
} from "@/entities/gym-booking";
import {
  BookingProblemNotice,
  bookingProblem,
  readProblem,
  useCheckIn,
  type BookingProblem,
} from "@/features/gym-class-booking";
import { initialsOf } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";
import { useGymWorkspace } from "@/widgets/gym-workspace";

/*
 * G03 Class roster (`mobile.gyms._gym-id.classes._class-id.roster`, SF-100;
 * Claude Design ClassRoster, version 1793198527-a0fc, 390 pt, labelled
 * FUTURE before SF-99): one class of the gym in the route, the backend's
 * counts (confirmed of capacity, places left, check-ins) and each booking
 * with the member's short name, never an email, profile or training data.
 *
 * Check-in is manual and the backend's (`record_check_in`): shown as done
 * only from its answer, at most one per booking (a repeat records nothing
 * new), refused outside the class's local day. Not built (no contract):
 * the waitlist with Promote and auto-fill, Pay at desk, Trial and levels;
 * no QR, NFC or self check-in (D-GYM-CLASS-ROSTER).
 */
export function ClassRosterScreen() {
  const { gymId, classId } = useLocalSearchParams<{ gymId: string; classId: string }>();
  const gym = useGymWorkspace(gymId);
  if (gym === undefined) return null;
  return <ClassRosterView key={`${gym.id}:${classId}`} gym={gym} classId={classId} />;
}

export function ClassRosterView({ gym, classId }: { gym: Gym; classId: string }) {
  const t = useTranslations("gymBooking.roster");
  const navigation = useNavigation();
  const title = useTranslations("routes.titles")("mobile/gyms/_gym-id/classes/_class-id/roster");
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  const occurrence = useGymClassOccurrence(gym.id, classId);
  const can = rosterCapabilities(gym.viewer);
  const item = occurrence.data;

  if (occurrence.isError) {
    return (
      <Screen>
        <BookingProblemNotice problem={readProblem(occurrence.error)} />
        <Button variant="secondary" label={t("retry")} onPress={() => void occurrence.refetch()} />
      </Screen>
    );
  }
  if (item === undefined) {
    return (
      <Screen>
        <View
          accessible
          accessibilityLabel={t("loading")}
          accessibilityRole="progressbar"
          className="gap-2"
        >
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </View>
      </Screen>
    );
  }
  return <Roster gym={gym} item={item} canCheckIn={can.canCheckIn} />;
}

function Roster({
  gym,
  item,
  canCheckIn,
}: {
  gym: Gym;
  item: GymClassOccurrence;
  canCheckIn: boolean;
}) {
  const t = useTranslations("gymBooking.roster");
  const format = useFormatter();
  const [view, setView] = useState<GymClassRosterView>("confirmed");
  const roster = useClassRoster(gym.id, item.occurrence_id, view);
  const checkIn = useCheckIn(gym.id, item.occurrence_id);
  const [outcome, setOutcome] = useState<
    { bookingId: string; problem: BookingProblem } | { bookingId: string; done: true } | null
  >(null);
  const scheduled = item.status === "scheduled";
  const problem = roster.query.isError ? readProblem(roster.query.error) : null;
  const eyebrow = t("eyebrow", {
    day: format.dateTime(printable(wallDate(item.local_starts_at)), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
    from: wallClock(item.local_starts_at),
    to: wallClock(item.local_ends_at),
    venue: item.venue.name,
  });

  return (
    <Screen>
      <View className="gap-3 rounded-3xl border border-border bg-surface px-4 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="label" color="highlight">
              {eyebrow}
            </Text>
            <Text variant="h3" accessibilityRole="header">
              {item.title}
            </Text>
            <Text variant="caption" color="mutedForeground">
              {item.instructor?.name
                ? t("coach", { name: item.instructor.name })
                : t("noInstructor")}
            </Text>
          </View>
          {roster.summary ? (
            <View className="items-end">
              <Text
                variant="metric"
                accessibilityLabel={t("summary.a11y", {
                  confirmed: roster.summary.confirmed_count,
                  capacity: roster.summary.capacity,
                })}
              >
                {t("summary.booked", {
                  confirmed: roster.summary.confirmed_count,
                  capacity: roster.summary.capacity,
                })}
              </Text>
              <Text variant="caption" color="mutedForeground">
                {t("summary.bookedLabel")}
              </Text>
            </View>
          ) : null}
        </View>
        {roster.summary ? (
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            <Text variant="caption" color="mutedForeground">
              {t("summary.remaining", { count: roster.summary.remaining_capacity })}
            </Text>
            <Text variant="caption" color="mutedForeground">
              {t("summary.checkedIn", { count: roster.summary.checked_in_count })}
            </Text>
          </View>
        ) : null}
      </View>
      {!scheduled ? (
        <Notice tone="amber" icon={Info}>
          {t("classCancelled")}
        </Notice>
      ) : null}
      <SegmentedControl
        label={t("views.label")}
        segments={[
          { value: "confirmed" as const, label: t("views.confirmed") },
          { value: "cancelled" as const, label: t("views.cancelled") },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "confirmed" && canCheckIn && scheduled ? (
        <Text variant="caption" color="faintForeground">
          {t("checkInNote")}
        </Text>
      ) : null}
      {problem !== null ? (
        <View className="gap-2">
          <BookingProblemNotice problem={problem} />
          <Button
            variant="secondary"
            label={t("retry")}
            onPress={() => void roster.query.refetch()}
          />
        </View>
      ) : !roster.complete ? (
        <View
          accessible
          accessibilityLabel={t("loading")}
          accessibilityRole="progressbar"
          className="gap-2"
        >
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </View>
      ) : roster.entries.length === 0 ? (
        <View className="rounded-3xl border border-dashed border-border px-4 py-6">
          <Text variant="bodySm" color="mutedForeground" className="text-center">
            {t(`empty.${view}`)}
          </Text>
        </View>
      ) : (
        <View className="rounded-3xl border border-border bg-surface px-4">
          {roster.entries.map((entry, index) => (
            <Row
              key={entry.booking_id}
              entry={entry}
              first={index === 0}
              canCheckIn={canCheckIn && scheduled && view === "confirmed"}
              pending={checkIn.isPending && checkIn.variables === entry.booking_id}
              busy={checkIn.isPending}
              outcome={outcome?.bookingId === entry.booking_id ? outcome : null}
              onCheckIn={() => {
                setOutcome(null);
                checkIn.mutate(entry.booking_id, {
                  onSuccess: () => setOutcome({ bookingId: entry.booking_id, done: true }),
                  onError: (error) =>
                    setOutcome({ bookingId: entry.booking_id, problem: bookingProblem(error) }),
                });
              }}
            />
          ))}
        </View>
      )}
      <Text variant="caption" color="faintForeground">
        {t("privacy")}
      </Text>
    </Screen>
  );
}

function Row({
  entry,
  first,
  canCheckIn,
  pending,
  busy,
  outcome,
  onCheckIn,
}: {
  entry: GymClassRosterEntry;
  first: boolean;
  canCheckIn: boolean;
  pending: boolean;
  busy: boolean;
  outcome: { problem: BookingProblem } | { done: true } | null;
  onCheckIn: () => void;
}) {
  const t = useTranslations("gymBooking.roster");
  const format = useFormatter();
  const name = entry.name ?? t("unnamed");
  const time = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <View
      className={`gap-2 py-3 ${first ? "" : "border-t border-border"}`}
      testID={`roster-entry-${entry.booking_id}`}
    >
      <View className="flex-row items-center gap-3">
        <View className="size-9 items-center justify-center rounded-full bg-muted">
          <Text variant="micro" weight="bold">
            {initialsOf(name.replace(/\./g, ""))}
          </Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="bodySm" weight="extrabold" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="mutedForeground">
            {entry.status === "cancelled" && entry.cancelled_at !== null
              ? t("cancelledAt", { time: time(entry.cancelled_at) })
              : t(`bookedVia.${entry.booked_via}`, { time: time(entry.confirmed_at) })}
          </Text>
        </View>
        {entry.status === "cancelled" ? (
          <Badge label={t(`reasons.${entry.cancel_reason ?? "member_cancelled"}`)} />
        ) : entry.checked_in_at !== null ? (
          <Badge
            variant="success"
            label={t("checkedInAt", {
              time: format.dateTime(new Date(entry.checked_in_at), {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          />
        ) : canCheckIn ? (
          <Button
            size="sm"
            variant="outline"
            label={pending ? t("checkingIn") : t("checkIn")}
            loading={pending}
            disabled={busy}
            accessibilityHint={t("checkInFor", { name })}
            testID={`check-in-${entry.booking_id}`}
            onPress={onCheckIn}
          />
        ) : (
          <Badge variant="neutral" label={t("booked")} />
        )}
      </View>
      {outcome !== null ? (
        "problem" in outcome ? (
          <BookingProblemNotice problem={outcome.problem} />
        ) : (
          <Notice tone="olive" icon={Check} live>
            {t("checkedInDone", { name })}
          </Notice>
        )
      ) : null}
    </View>
  );
}
