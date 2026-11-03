import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslations } from "use-intl";

import {
  currentMemberships,
  useMyGymMemberships,
  type GymMembership,
} from "@/entities/gym-booking";
import { BookingProblemNotice, readProblem } from "@/features/gym-class-booking";
import { routeHref } from "@/shared/routes/routes";
import { initialsOf } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { MemberState, useScreenTitle } from "./parts";

/*
 * My gyms (`mobile.me.gyms`, SF-100): F16's "My gyms" rows and its "Book a
 * class" entry (Claude Design Membership, version 1793198527-a0fc), at
 * account level (ADR 0026 D-G07). Every row is the backend's (SF-95
 * `GET /me/gym-memberships`, every page): an active membership opens its
 * classes (F13), a pending request says it waits for the gym. F16's pass and
 * QR (D-G19 open), plan, renewal, PT pack, credits and visit counts have no
 * contract and are not built (D-MOBILE-GYM-MEMBER-BOOKING).
 */
export function MemberGymsScreen() {
  const t = useTranslations("gymBooking.member.gyms");
  const router = useRouter();
  useScreenTitle("mobile/me/gyms");
  const list = useMyGymMemberships();
  const current = currentMemberships(list.memberships);

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
          className="gap-2.5"
        >
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-16 rounded-3xl" />
        </View>
      ) : current.length === 0 ? (
        <MemberState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <View className="gap-2.5">
          {current.map((membership) => (
            <GymRow
              key={membership.gym_member_id}
              membership={membership}
              onOpen={() =>
                router.push(
                  routeHref("mobile.me.gyms._gym-id.classes", { gymId: membership.gym.gym_id }),
                )
              }
            />
          ))}
        </View>
      )}
      <Text variant="caption" color="faintForeground">
        {t("note")}
      </Text>
    </Screen>
  );
}

function GymRow({ membership, onOpen }: { membership: GymMembership; onOpen: () => void }) {
  const t = useTranslations("gymBooking.member.gyms");
  const name = membership.gym.name ?? t("unnamedGym");
  const active = membership.status === "active";
  const body = (
    <>
      <View className="size-11 items-center justify-center rounded-xl bg-accent">
        <Text variant="caption" weight="bold" color="highlight">
          {initialsOf(name)}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {active ? t("activeLine") : t("requestedLine")}
        </Text>
      </View>
      <Badge
        variant={active ? "accent" : "warning"}
        label={t(active ? "status.active" : "status.requested")}
      />
      {active ? <Icon icon={ChevronRight} size={18} color="faintForeground" /> : null}
    </>
  );
  const row =
    "min-h-16 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3";
  return active ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("open", { gym: name })}
      onPress={onOpen}
      testID={`member-gym-${membership.gym.gym_id}`}
      className={row}
    >
      {body}
    </Pressable>
  ) : (
    <View className={row} accessible accessibilityLabel={`${name}, ${t("requestedLine")}`}>
      {body}
    </View>
  );
}
