import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { useMyGymMemberships, type GymMembership } from "@/entities/gym-booking";
import { BookingProblemNotice, readProblem } from "@/features/gym-class-booking";
import {
  membershipProblem,
  useCancelJoinRequest,
  useLeaveGym,
  useMyGymInvitations,
} from "@/features/gym-membership-manage";
import { routeHref } from "@/shared/routes/routes";
import { initialsOf } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { ConfirmSheet, useMembershipProblemText } from "./membership-parts";
import { MemberState, useScreenTitle } from "./parts";

/*
 * My gyms (`mobile.me.gyms`, SF-100, SF-135): F16's "My gyms" rows and its "Book
 * a class" entry (Claude Design Membership, version 1793198527-a0fc), at account
 * level (ADR 0026 D-G07). Every row and status is the backend's (SF-95
 * `GET /me/gym-memberships`, every page), in its own lifecycle: `active` opens
 * its classes (F13) and can be left, `requested` waits for the gym and can be
 * cancelled, and `rejected`, `cancelled` and `ended` are history. F16's pass and
 * QR (D-G19 open), plan, renewal, PT pack, credits and visit counts have no
 * contract and are not built (D-MOBILE-GYM-MEMBER-BOOKING). A membership needs no
 * Fighter or Coach profile and gives no gym workspace; a gym the person manages
 * or works for is another domain and is not listed here.
 */
export function MemberGymsScreen() {
  const t = useTranslations("gymBooking.member.gyms");
  const m = useTranslations("gymMembership");
  const router = useRouter();
  useScreenTitle("mobile/me/gyms");
  const list = useMyGymMemberships();
  const inbox = useMyGymInvitations();
  const by = (status: GymMembership["status"]) =>
    list.memberships.filter((membership) => membership.status === status);
  const active = by("active");
  const requested = by("requested");
  const history = list.memberships.filter(
    (membership) => membership.status !== "active" && membership.status !== "requested",
  );
  const pendingInvitations = inbox.invitations.filter(
    (invitation) => invitation.status === "pending",
  ).length;

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="label" color="faintForeground">
          {t("eyebrow")}
        </Text>
        <Text variant="h1" accessibilityRole="header">
          {t("title")}
        </Text>
      </View>
      <View className="gap-2.5">
        <Button
          label={m("actions.join")}
          testID="member-join"
          onPress={() => router.push(routeHref("mobile.me.gyms.join"))}
        />
        <Button
          variant="outline"
          testID="member-inbox"
          label={
            pendingInvitations > 0
              ? m("actions.invitationsCount", { count: pendingInvitations })
              : m("actions.invitations")
          }
          onPress={() => router.push(routeHref("mobile.me.gyms.invitations"))}
        />
      </View>
      {list.query.isError ? (
        <View className="gap-2">
          <BookingProblemNotice problem={readProblem(list.query.error)} />
          <Button variant="outline" label={t("retry")} onPress={() => void list.query.refetch()} />
        </View>
      ) : !list.complete ? (
        <View
          accessible
          accessibilityLabel={t("loading")}
          accessibilityRole="progressbar"
          className="gap-2.5"
        >
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-16 rounded-3xl" />
        </View>
      ) : (
        <>
          {active.length === 0 && requested.length === 0 ? (
            <MemberState title={t("empty.title")} body={t("empty.body")} />
          ) : null}
          <Section title={m("sections.active")} items={active} />
          <Section title={m("sections.requests")} items={requested} />
          <Section title={m("sections.history")} items={history} />
        </>
      )}
      <Text variant="caption" color="faintForeground">
        {t("note")}
      </Text>
    </Screen>
  );
}

function Section({ title, items }: { title: string; items: GymMembership[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-2.5">
      <Text variant="label" color="faintForeground" accessibilityRole="header">
        {title}
      </Text>
      {items.map((membership) => (
        <GymRow key={membership.gym_member_id} membership={membership} />
      ))}
    </View>
  );
}

const ROW =
  "min-h-16 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3";

function Identity({ name, line }: { name: string; line: string }) {
  return (
    <>
      <View className="size-11 items-center justify-center rounded-xl bg-accent">
        <Text variant="caption" weight="bold" color="highlight">
          {initialsOf(name)}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold">
          {name}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {line}
        </Text>
      </View>
    </>
  );
}

function GymRow({ membership }: { membership: GymMembership }) {
  const t = useTranslations("gymBooking.member.gyms");
  const m = useTranslations("gymMembership");
  const format = useFormatter();
  const router = useRouter();
  const name = membership.gym.name ?? t("unnamedGym");

  if (membership.status === "active") {
    return (
      <View className="gap-1.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("open", { gym: name })}
          onPress={() =>
            router.push(
              routeHref("mobile.me.gyms._gym-id.classes", { gymId: membership.gym.gym_id }),
            )
          }
          testID={`member-gym-${membership.gym.gym_id}`}
          className={ROW}
        >
          <Identity name={name} line={t("activeLine")} />
          <Badge variant="accent" label={t("status.active")} />
          <Icon icon={ChevronRight} size={18} color="faintForeground" />
        </Pressable>
        <LeaveAction gymMemberId={membership.gym_member_id} gym={name} />
      </View>
    );
  }
  if (membership.status === "requested") {
    return (
      <View className="gap-1.5">
        <View
          className={ROW}
          accessible
          accessibilityLabel={`${name}, ${t("requestedLine")}`}
          testID={`member-gym-${membership.gym.gym_id}`}
        >
          <Identity name={name} line={t("requestedLine")} />
          <Badge variant="warning" label={t("status.requested")} />
        </View>
        <CancelRequestAction gymMemberId={membership.gym_member_id} gym={name} />
      </View>
    );
  }

  const status = membership.status as "rejected" | "cancelled" | "ended";
  const when = membership.ended_at ?? membership.responded_at ?? membership.requested_at;
  const line =
    status === "ended"
      ? m(`history.ended.${membership.ended_reason ?? "unknown"}`)
      : m(`history.${status}`);
  const text = when === null ? line : `${line} · ${format.dateTime(new Date(when), "date")}`;
  return (
    <View className={ROW} accessible accessibilityLabel={`${name}, ${text}`}>
      <Identity name={name} line={text} />
      <Badge variant="neutral" label={m(`history.status.${status}`)} />
    </View>
  );
}

function CancelRequestAction({ gymMemberId, gym }: { gymMemberId: string; gym: string }) {
  const t = useTranslations("gymMembership.cancelRequest");
  const text = useMembershipProblemText();
  const cancel = useCancelJoinRequest();
  return (
    <ConfirmSheet
      title={t("title")}
      body={t("body", { gym })}
      keep={t("keep")}
      confirm={t("confirm")}
      pendingLabel={t("pending")}
      closeLabel={t("keep")}
      isPending={cancel.isPending}
      problem={cancel.isError ? text(membershipProblem(cancel.error)) : null}
      onOpen={() => cancel.reset()}
      onConfirm={(close) => cancel.mutate(gymMemberId, { onSuccess: close })}
      trigger={(open) => (
        <Button
          variant="ghost"
          size="sm"
          label={t("action")}
          accessibilityHint={gym}
          onPress={open}
        />
      )}
    />
  );
}

function LeaveAction({ gymMemberId, gym }: { gymMemberId: string; gym: string }) {
  const t = useTranslations("gymMembership.leave");
  const text = useMembershipProblemText();
  const leave = useLeaveGym();
  return (
    <ConfirmSheet
      title={t("title", { gym })}
      body={t("body")}
      keep={t("keep")}
      confirm={t("confirm")}
      pendingLabel={t("pending")}
      closeLabel={t("keep")}
      isPending={leave.isPending}
      problem={leave.isError ? text(membershipProblem(leave.error)) : null}
      onOpen={() => leave.reset()}
      onConfirm={(close) => leave.mutate(gymMemberId, { onSuccess: close })}
      trigger={(open) => (
        <Button
          variant="ghost"
          size="sm"
          label={t("action")}
          accessibilityHint={gym}
          onPress={open}
        />
      )}
    />
  );
}
