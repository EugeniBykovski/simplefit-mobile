import { useRouter } from "expo-router";
import { Check, CircleAlert, Clock, Info } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import {
  datesFrom,
  deviceToday,
  membershipOf,
  printable,
  useMemberClasses,
  useMyGymMemberships,
  wallClock,
  wallDate,
  windowFor,
  type GymMemberClass,
  type GymMembership,
} from "@/entities/gym-booking";
import {
  BookingProblemNotice,
  bookingProblem,
  readProblem,
  useBookClass,
  useCancelMyBooking,
} from "@/features/gym-class-booking";
import { routeHref } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Sheet } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { MemberState, useScreenTitle } from "./parts";

/** The clock, read now and every half minute: a class that starts meanwhile stops being offered. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/*
 * F13 Book a class (`mobile.me.gyms._gym-id.classes`, SF-100; Claude Design
 * BookClass, version 1793198527-a0fc, 390 pt), at account level (ADR 0026
 * D-G07): a gym member needs no Fighter profile. The membership is the
 * viewer's own (SF-95 list); only an active one shows classes.
 *
 * Built from F13: the day chips, the class rows (time, title, instructor ·
 * venue · the backend's places left) and the chosen class's sheet with
 * Confirm booking. Added: Cancel booking for the member's own booking (in
 * the same sheet, confirmed first). Not built (no contract): the gym
 * selector (the gym comes from My gyms), the credits pill, the Classes / PT
 * / Sparring slot segments, "Uses 1 credit", "Free cancel until",
 * reminders and the waitlist (D-MOBILE-GYM-MEMBER-BOOKING).
 */
export function MemberClassesScreen({ gymId }: { gymId: string }) {
  const t = useTranslations("gymBooking.member.classes");
  const router = useRouter();
  useScreenTitle("mobile/me/gyms/_gym-id/classes");
  const list = useMyGymMemberships();
  const membership = list.complete ? membershipOf(list.memberships, gymId) : undefined;
  const gymName = membership?.gym.name ?? t("thisGym");
  const back = (
    <Button
      variant="secondary"
      label={t("backToGyms")}
      onPress={() => router.replace(routeHref("mobile.me.gyms"))}
    />
  );

  if (list.query.isError) {
    return (
      <Screen>
        <BookingProblemNotice problem={readProblem(list.query.error)} />
        <Button variant="secondary" label={t("retry")} onPress={() => void list.query.refetch()} />
      </Screen>
    );
  }
  if (membership === undefined) {
    return (
      <Screen>
        <Loading label={t("loading")} />
      </Screen>
    );
  }
  if (membership === null)
    return (
      <Screen>
        <MemberState title={t("notMember.title")} body={t("notMember.body")} action={back} />
      </Screen>
    );
  if (membership.status === "requested")
    return (
      <Screen>
        <MemberState
          title={t("requested.title")}
          body={t("requested.body", { gym: gymName })}
          action={back}
        />
      </Screen>
    );
  if (membership.status !== "active")
    return (
      <Screen>
        <MemberState
          title={t("ended.title")}
          body={t("ended.body", { gym: gymName })}
          action={back}
        />
      </Screen>
    );
  return <ClassesView key={membership.gym_member_id} membership={membership} />;
}

function Loading({ label }: { label: string }) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" className="gap-2">
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-16 rounded-3xl" />
      <Skeleton className="h-16 rounded-3xl" />
    </View>
  );
}

type ClassState = "booked" | "checkedIn" | "cancelled" | "started" | "full" | "open";

function classState(item: GymMemberClass, now: number): ClassState {
  if (item.booking?.status === "confirmed")
    return item.booking.checked_in_at !== null ? "checkedIn" : "booked";
  if (item.status === "cancelled") return "cancelled";
  if (new Date(item.starts_at).getTime() <= now) return "started";
  if (item.remaining_capacity <= 0) return "full";
  return "open";
}

function ClassesView({ membership }: { membership: GymMembership }) {
  const t = useTranslations("gymBooking.member.classes");
  const format = useFormatter();
  const first = deviceToday();
  const dates = useMemo(() => datesFrom(first, 7), [first]);
  const [day, setDay] = useState(first);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const window = useMemo(() => windowFor(dates[0] ?? first, dates[6] ?? first), [dates, first]);
  const classes = useMemberClasses(membership.gym_member_id, window);
  const now = useNow();
  const ofDay = classes.classes.filter((item) => wallDate(item.local_starts_at) === day);
  const selected = classes.classes.find((item) => item.occurrence_id === selectedId) ?? null;
  const zone = classes.classes[0]?.time_zone ?? null;
  const ended = classes.query.isError && readProblem(classes.query.error).kind === "membership";

  if (ended) {
    return (
      <Screen>
        <MemberState
          title={t("ended.title")}
          body={t("ended.body", { gym: membership.gym.name ?? t("thisGym") })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-3.5">
        <View className="min-h-11 flex-row items-center rounded-2xl border border-border bg-surface px-3.5">
          <Text variant="bodySm" weight="bold" numberOfLines={1}>
            {membership.gym.name ?? t("thisGym")}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-1.5"
          accessibilityRole="radiogroup"
          accessibilityLabel={t("days")}
        >
          {dates.map((date) => (
            <Chip
              key={date}
              label={
                date === first
                  ? t("today")
                  : format.dateTime(printable(date), {
                      weekday: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })
              }
              checked={date === day}
              onPress={() => setDay(date)}
            />
          ))}
        </ScrollView>
        {zone !== null ? (
          <Text variant="caption" color="faintForeground">
            {t("zone", { zone })}
          </Text>
        ) : null}
      </View>
      {classes.query.isError ? (
        <View className="gap-2">
          <BookingProblemNotice problem={readProblem(classes.query.error)} />
          <Button
            variant="secondary"
            label={t("retry")}
            onPress={() => void classes.query.refetch()}
          />
        </View>
      ) : !classes.complete ? (
        <Loading label={t("loading")} />
      ) : ofDay.length === 0 ? (
        <View className="rounded-3xl border border-dashed border-border px-4 py-8">
          <Text variant="bodySm" color="mutedForeground" className="text-center">
            {t("emptyDay")}
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {ofDay.map((item) => (
            <ClassRow
              key={item.occurrence_id}
              item={item}
              state={classState(item, now)}
              selected={item.occurrence_id === selectedId}
              onPress={() => setSelectedId(item.occurrence_id)}
            />
          ))}
        </View>
      )}
      <Text variant="caption" color="faintForeground">
        {t("note")}
      </Text>
      {selected !== null ? (
        <ClassSheet
          item={selected}
          state={classState(selected, now)}
          upcoming={new Date(selected.starts_at).getTime() > now}
          gymMemberId={membership.gym_member_id}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </Screen>
  );
}

function placesText(
  t: ReturnType<typeof useTranslations<"gymBooking.member.classes">>,
  item: GymMemberClass,
) {
  if (item.status === "cancelled") return t("places.cancelled");
  if (item.remaining_capacity <= 0) return t("places.full", { capacity: item.capacity });
  return t("places.left", { left: item.remaining_capacity, capacity: item.capacity });
}

function ClassRow({
  item,
  state,
  selected,
  onPress,
}: {
  item: GymMemberClass;
  state: ClassState;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("gymBooking.member.classes");
  const line = [item.instructor?.name, item.venue.name, placesText(t, item)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${wallClock(item.local_starts_at)}, ${item.title}, ${line}, ${t(`states.${state}`)}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`member-class-${item.occurrence_id}`}
      className={`min-h-16 flex-row items-center gap-3 rounded-3xl px-3.5 py-3 ${selected ? "border-[1.5px] border-primary bg-surface-elevated" : "border border-border bg-surface"}`}
    >
      <Text variant="title" className="w-14">
        {wallClock(item.local_starts_at)}
      </Text>
      <View className="flex-1 gap-1">
        <Text variant="bodySm" weight="extrabold">
          {item.title}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {line}
        </Text>
      </View>
      <StateBadge state={state} />
    </Pressable>
  );
}

function StateBadge({ state }: { state: ClassState }) {
  const t = useTranslations("gymBooking.member.classes.states");
  const variant = {
    booked: "accent",
    checkedIn: "success",
    cancelled: "destructive",
    started: "neutral",
    full: "warning",
    open: "primary",
  } as const;
  return <Badge variant={variant[state]} label={t(state)} />;
}

/**
 * The chosen class (F13's sheet): Confirm booking, or Cancel booking for the
 * member's own booking after a confirmation in the same sheet. Success is
 * said only from the backend's answer; a lost answer keeps the request key
 * and "Try again" sends the same request.
 */
function ClassSheet({
  item,
  state,
  upcoming,
  gymMemberId,
  onClose,
}: {
  item: GymMemberClass;
  state: ClassState;
  upcoming: boolean;
  gymMemberId: string;
  onClose: () => void;
}) {
  const t = useTranslations("gymBooking.member.classes");
  const c = useTranslations("gymBooking.member.cancel");
  const format = useFormatter();
  const book = useBookClass(gymMemberId);
  const cancel = useCancelMyBooking();
  const [confirmed, setConfirmed] = useState(false);
  const [asking, setAsking] = useState(false);
  const pending = book.isPending || cancel.isPending;
  const failed = book.isError ? bookingProblem(book.error) : null;
  // A lost answer whose booking the re-read shows: the outcome is known now.
  const reconciled = failed?.kind === "unknown" && state === "booked";
  const bookProblem = reconciled ? null : failed;
  const cancelProblem = cancel.isError ? bookingProblem(cancel.error) : null;
  const day = format.dateTime(printable(wallDate(item.local_starts_at)), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const when = `${format.dateTime(printable(wallDate(item.local_starts_at)), { dateStyle: "full", timeZone: "UTC" })} · ${wallClock(item.local_starts_at)}`;

  return (
    <Sheet
      visible
      onClose={onClose}
      dismissible={!pending}
      title={asking ? c("title") : item.title}
      description={
        asking
          ? c("body", { title: item.title, when })
          : t("detailsEyebrow", {
              day,
              minutes: item.duration_minutes,
              venue: item.venue.name ?? "",
            })
      }
      closeLabel={t("close")}
      role={asking ? "alert" : undefined}
    >
      {asking && item.booking !== null ? (
        <View className="gap-2.5">
          {cancelProblem ? <BookingProblemNotice problem={cancelProblem} /> : null}
          <Button
            variant="destructive"
            size="lg"
            label={
              cancel.isPending
                ? c("pending")
                : cancelProblem?.kind === "unknown"
                  ? c("again")
                  : c("confirm")
            }
            loading={cancel.isPending}
            disabled={pending}
            onPress={() =>
              cancel.mutate(item.booking!.booking_id, {
                onSuccess: () => {
                  setAsking(false);
                  cancel.reset();
                },
              })
            }
          />
          <Button
            variant="quiet"
            label={c("keep")}
            disabled={pending}
            onPress={() => setAsking(false)}
          />
        </View>
      ) : (
        <View className="gap-3.5">
          <View className="flex-row items-center justify-between">
            <Text variant="h2" color="highlight">
              {wallClock(item.local_starts_at)}
            </Text>
            <Text variant="caption" color="mutedForeground">
              {t("until", { time: wallClock(item.local_ends_at) })}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Fact text={placesText(t, item)} />
            {item.instructor?.name ? (
              <Fact text={t("instructor", { name: item.instructor.name })} />
            ) : null}
          </View>
          {(confirmed || reconciled) && state === "booked" ? (
            <Notice tone="olive" icon={Check} live>
              {t("confirmedNotice")}
            </Notice>
          ) : null}
          {bookProblem ? <BookingProblemNotice problem={bookProblem} /> : null}
          {item.booking?.status === "cancelled" && state === "open" ? (
            <Text variant="caption" color="mutedForeground">
              {t("cancelledBefore")}
            </Text>
          ) : null}
          {state === "open" ? (
            <Button
              size="lg"
              label={
                book.isPending
                  ? t("booking")
                  : bookProblem?.kind === "unknown"
                    ? t("tryAgain")
                    : t("confirm")
              }
              loading={book.isPending}
              disabled={pending}
              testID="confirm-booking"
              onPress={() => {
                setConfirmed(false);
                book.mutate(item.occurrence_id, { onSuccess: () => setConfirmed(true) });
              }}
            />
          ) : null}
          {state === "booked" && upcoming ? (
            <>
              <Button
                variant="destructiveSubtle"
                size="lg"
                label={t("cancelBooking")}
                disabled={pending}
                onPress={() => setAsking(true)}
              />
              <Text variant="caption" color="faintForeground">
                {t("cancelNote")}
              </Text>
            </>
          ) : null}
          {state === "booked" && !upcoming ? (
            <Notice icon={Clock}>{t("startedBooked")}</Notice>
          ) : null}
          {state === "checkedIn" && item.booking?.checked_in_at ? (
            <Notice tone="olive" icon={Check}>
              {t("checkedInNotice", {
                time: format.dateTime(new Date(item.booking.checked_in_at), {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: item.time_zone,
                }),
              })}
            </Notice>
          ) : null}
          {state === "full" ? (
            <Notice tone="amber" icon={Info}>
              {t("fullNotice")}
            </Notice>
          ) : null}
          {state === "started" ? <Notice icon={Clock}>{t("startedNotice")}</Notice> : null}
          {state === "cancelled" ? (
            <Notice tone="amber" icon={CircleAlert}>
              {t("cancelledNotice")}
            </Notice>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

function Fact({ text }: { text: string }) {
  return (
    <View className="rounded-xl bg-muted px-2.5 py-1.5">
      <Text variant="caption" weight="bold">
        {text}
      </Text>
    </View>
  );
}
