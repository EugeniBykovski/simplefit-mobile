import { useRouter } from "expo-router";
import { ChevronRight, CircleAlert, Lock, Plus, UserRound } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import {
  isUnavailable,
  useCoachFighters,
  type CoachFighter,
  type CoachFighterStatus,
} from "@/entities/coach-fighter";
import { useCoachInvitations, type CoachInvitation } from "@/entities/coach-invitation";
import { InviteFighterSheet } from "@/features/coach-invitation-create";
import { InvitationActions } from "@/features/coach-invitation-manage";
import { countryName } from "@/shared/lib/countries";
import { routeHref } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

/*
 * C03 Fighters (`mobile.coach.fighters`, SF-61; Claude Design Fighters,
 * version 1792155768-3179, 390 pt), the Coach app's Fighters tab.
 *
 * Three views of the coach's real records (`?view=`): Active and Ended
 * relationships (SF-56, `listMyCoachFighters`) and Invitations (SF-57,
 * `listMyCoachInvitations`). An invitation is never a fighter. Active rows
 * show only the C1+C2 fields each fighter disclosed and open C04; ended rows
 * only the name at the end and the dates. Loading, empty, unavailable
 * (`404`: sharing off or no completed coach profile) and failure are four
 * separate states. The + button opens the invite sheet.
 */

export type CoachFightersView = CoachFighterStatus | "invitations";
const VIEWS: readonly CoachFightersView[] = ["active", "ended", "invitations"];

export function CoachFightersScreen({ view }: { view: CoachFightersView }) {
  const t = useTranslations("coachFighters");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inviting, setInviting] = useState(false);
  // Sharing off answers the roster with 404: inviting is then unavailable too.
  const gate = useCoachFighters("active");
  const unavailable = gate.isError && isUnavailable(gate.error);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="gap-3.5 px-5 pb-3 pt-3">
        <View className="flex-row items-center justify-between">
          <Text variant="h1" accessibilityRole="header">
            {t("title")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("invite.open")}
            accessibilityState={{ disabled: unavailable }}
            disabled={unavailable}
            onPress={() => setInviting(true)}
            className={`size-11 items-center justify-center rounded-full ${unavailable ? "bg-muted" : "bg-primary active:opacity-80"}`}
          >
            <Icon icon={Plus} color={unavailable ? "faintForeground" : "primaryForeground"} />
          </Pressable>
        </View>
        <SegmentedControl
          label={t("views")}
          value={view}
          segments={VIEWS.map((value) => ({ value, label: t(`tabs.${value}`) }))}
          onChange={(next) =>
            router.replace(
              routeHref("mobile.coach.fighters", {}, next === "active" ? {} : { view: next }),
            )
          }
        />
      </View>
      {view === "invitations" ? <Invitations unavailable={unavailable} /> : <Roster view={view} />}
      <InviteFighterSheet visible={inviting} onClose={() => setInviting(false)} />
    </View>
  );
}

/** Bottom space for the floating tab bar (68 pt bar + 22 pt gap) and the home indicator. */
const useListBottom = () => useSafeAreaInsets().bottom + 112;

function Roster({ view }: { view: CoachFighterStatus }) {
  const t = useTranslations("coachFighters");
  const list = useCoachFighters(view);
  const bottom = useListBottom();
  const rows = list.data?.pages.flatMap((page) => page.relationships) ?? [];

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="gap-2 px-5"
      contentContainerStyle={{ paddingBottom: bottom }}
      data={list.isSuccess ? rows : []}
      keyExtractor={(item) => item.relationship_id}
      renderItem={({ item }) =>
        view === "active" ? <ActiveRow fighter={item} /> : <EndedRow fighter={item} />
      }
      ListEmptyComponent={<ListState kind="roster" view={view} query={list} />}
      ListFooterComponent={
        list.isSuccess && rows.length > 0 ? (
          <Footer
            hasMore={list.hasNextPage}
            loadingMore={list.isFetchingNextPage}
            loadMoreFailed={list.isFetchNextPageError}
            onMore={() => void list.fetchNextPage()}
            note={view === "ended" ? t("endedNote") : t("privacy")}
          />
        ) : null
      }
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => void list.refetch()}
    />
  );
}

function Invitations({ unavailable }: { unavailable: boolean }) {
  const t = useTranslations("coachFighters");
  const list = useCoachInvitations({ enabled: !unavailable });
  const bottom = useListBottom();
  const rows = list.data?.pages.flatMap((page) => page.invitations) ?? [];

  if (unavailable) {
    return (
      <View className="px-5">
        <Message icon={Lock} title={t("unavailable.title")} body={t("unavailable.body")} />
      </View>
    );
  }
  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="gap-2 px-5"
      contentContainerStyle={{ paddingBottom: bottom }}
      data={list.isSuccess ? rows : []}
      keyExtractor={(item) => item.invitation_id}
      renderItem={({ item }) => <InvitationRow invitation={item} />}
      ListEmptyComponent={<ListState kind="invitations" view="active" query={list} />}
      ListFooterComponent={
        list.isSuccess && rows.length > 0 ? (
          <Footer
            hasMore={list.hasNextPage}
            loadingMore={list.isFetchingNextPage}
            loadMoreFailed={list.isFetchNextPageError}
            onMore={() => void list.fetchNextPage()}
            note={t("invitations.note")}
          />
        ) : null
      }
      refreshing={list.isRefetching && !list.isFetchingNextPage}
      onRefresh={() => void list.refetch()}
    />
  );
}

function ListState({
  kind,
  view,
  query,
}: {
  kind: "roster" | "invitations";
  view: CoachFighterStatus;
  query: { isError: boolean; error: unknown; data: unknown; refetch: () => unknown };
}) {
  const t = useTranslations("coachFighters");
  if (query.isError && isUnavailable(query.error)) {
    return <Message icon={Lock} title={t("unavailable.title")} body={t("unavailable.body")} />;
  }
  if (query.isError) {
    return (
      <View className="gap-3" testID="coach-fighters:failed">
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
        accessibilityLabel={t("loading")}
        className="gap-2"
        testID="coach-fighters:loading"
      >
        <Skeleton className="h-17 rounded-3xl" />
        <Skeleton className="h-17 rounded-3xl" />
      </View>
    );
  }
  const key = kind === "invitations" ? "invitations" : view;
  return <Message icon={UserRound} title={t(`empty.${key}.title`)} body={t(`empty.${key}.body`)} />;
}

function Message({ icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <View
      accessible
      accessibilityRole="summary"
      className="items-start gap-2.5 rounded-3xl border border-border bg-surface p-5"
    >
      <View className="size-11 items-center justify-center rounded-2xl bg-accent">
        <Icon icon={icon} color="highlight" />
      </View>
      <Text variant="h3">{title}</Text>
      <Text color="mutedForeground">{body}</Text>
    </View>
  );
}

function Footer({
  hasMore,
  loadingMore,
  loadMoreFailed,
  onMore,
  note,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onMore: () => void;
  note: string;
}) {
  const t = useTranslations("coachFighters");
  return (
    <View className="gap-3 pt-1">
      {loadMoreFailed ? (
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {t("failed.more")}
          </Notice>
        </View>
      ) : null}
      {hasMore ? (
        <Button
          label={loadingMore ? t("loadingMore") : t("more")}
          variant="quiet"
          loading={loadingMore}
          disabled={loadingMore}
          onPress={onMore}
        />
      ) : null}
      <Text variant="caption" color="faintForeground">
        {note}
      </Text>
    </View>
  );
}

/** The fighter's disclosed identity line: username, place and level when shared. */
function useSummary(fighter: CoachFighter["fighter"]) {
  const levels = useTranslations("fighterOnboarding.experience.levels");
  const locale = useLocale();
  const place = [
    fighter?.city,
    fighter?.country_code ? countryName(fighter.country_code, locale) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [
    fighter?.username ? `@${fighter.username}` : null,
    place || null,
    fighter?.experience_level ? levels(`${fighter.experience_level}.title`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ActiveRow({ fighter }: { fighter: CoachFighter }) {
  const t = useTranslations("coachFighters");
  const router = useRouter();
  const name = fighter.fighter?.display_name ?? t("fallbackName");
  const summary = useSummary(fighter.fighter);
  const line = summary || t("notShared");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${line}`}
      accessibilityHint={t("row.open")}
      onPress={() =>
        router.push(
          routeHref("mobile.coach.fighters._fighter-id", { fighterId: fighter.relationship_id }),
        )
      }
      className="min-h-17 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-3.5 py-3 active:bg-muted"
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

function EndedRow({ fighter }: { fighter: CoachFighter }) {
  const t = useTranslations("coachFighters");
  const format = useFormatter();
  const name = fighter.fighter_display_name_at_end ?? t("fallbackName");
  const line = t("row.ended", {
    date: fighter.ended_at ? format.dateTime(new Date(fighter.ended_at), "date") : "",
    by: fighter.ended_by === "coach" ? t("row.endedBy.coach") : t("row.endedBy.fighter"),
  });
  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${line}`}
      className="min-h-16 flex-row items-center gap-3 rounded-3xl border border-border bg-background px-3.5 py-3"
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

function InvitationRow({ invitation }: { invitation: CoachInvitation }) {
  const t = useTranslations("coachFighters.invitations");
  const format = useFormatter();
  const date = (value: string | null) => (value ? format.dateTime(new Date(value), "date") : "");
  const status = invitation.status;
  const line =
    status === "pending"
      ? t("line.pending", {
          sent: date(invitation.last_sent_at),
          expires: date(invitation.expires_at),
        })
      : t(`line.${status}`, {
          date: date(status === "expired" ? invitation.expires_at : invitation.responded_at),
        });

  return (
    <View className="gap-1.5 rounded-3xl border border-border bg-surface px-3.5 py-3">
      <View
        accessible
        accessibilityLabel={`${invitation.recipient_email}, ${t(`status.${status}`)}, ${line}`}
        className="gap-1"
      >
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="bodySm" weight="extrabold" numberOfLines={1} className="flex-shrink">
            {invitation.recipient_email}
          </Text>
          <Badge
            label={t(`status.${status}`)}
            variant={status === "pending" ? "accent" : "neutral"}
          />
        </View>
        <Text variant="caption" color="faintForeground">
          {line}
        </Text>
      </View>
      {status === "pending" ? <InvitationActions invitation={invitation} /> : null}
    </View>
  );
}
