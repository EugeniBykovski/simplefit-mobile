import { useNavigation, useRouter } from "expo-router";
import { ChevronRight, CircleAlert, Lock, Mail } from "lucide-react-native";
import { useLayoutEffect } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";

import {
  inboxProblem,
  useIncomingInvitations,
  type IncomingCoachInvitation,
} from "@/entities/incoming-coach-invitation";
import { routeHref } from "@/shared/routes/routes";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

/*
 * FCI1 Invitations (`mobile.profile.coaches.invitations`, SF-76; Claude
 * Design FighterCoaches screen=invites, version 1792432236-08da), pushed
 * from FC1.
 *
 * The coach invitations addressed to the fighter's verified email
 * identities, from `listMyIncomingCoachInvitations` (SF-73), newest first,
 * with the backend's effective status. Only pending ones open FCI2; the
 * others show their status and date and open nothing. Loading, an empty
 * inbox, unavailable (`404`: Coach–Fighter sharing is off; never shown as
 * empty), account registration first (`422`) and a failure are separate
 * states. Only the coach's public identity is shown: never a token, an
 * address or anything about the recipient.
 */

export function InvitationsScreen() {
  const t = useTranslations("fighterInvitations");
  const titles = useTranslations("routes.titles");
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const list = useIncomingInvitations();
  const title = titles("mobile/profile/coaches/invitations");

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const rows = list.data?.pages.flatMap((page) => page.invitations) ?? [];

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-2.5 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      data={list.isSuccess ? rows : []}
      keyExtractor={(item) => item.invitation_id}
      ListHeaderComponent={
        <Text color="mutedForeground" className="pb-1.5">
          {t("intro")}
        </Text>
      }
      renderItem={({ item }) => <InvitationRow invitation={item} />}
      ListEmptyComponent={<ListState list={list} />}
      ListFooterComponent={
        list.isSuccess && list.hasNextPage ? (
          <View className="pt-1">
            <Button
              label={list.isFetchingNextPage ? t("loadingMore") : t("more")}
              variant="quiet"
              loading={list.isFetchingNextPage}
              disabled={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          </View>
        ) : null
      }
    />
  );
}

function ListState({ list }: { list: ReturnType<typeof useIncomingInvitations> }) {
  const t = useTranslations("fighterInvitations");

  if (list.isError) {
    const problem = inboxProblem(list.error);
    if (problem === "sharing") {
      return (
        <Message
          icon={Lock}
          title={t("sharing.title")}
          body={t("sharing.body")}
          testID="invitations:sharing"
        />
      );
    }
    if (problem === "profile") {
      return (
        <Message
          icon={Lock}
          title={t("profile.title")}
          body={t("profile.body")}
          testID="invitations:profile"
        />
      );
    }
    return (
      <View className="gap-3" testID="invitations:failed">
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {`${t("failed.title")} ${t("failed.body")}`}
          </Notice>
        </View>
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
        testID="invitations:loading"
      >
        <Skeleton className="h-19 rounded-3xl" />
        <Skeleton className="h-19 rounded-3xl" />
      </View>
    );
  }
  return (
    <Message
      icon={Mail}
      title={t("empty.title")}
      body={t("empty.body")}
      testID="invitations:empty"
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

/** The inviting coach's name: display name, else brand. */
export function inviterName(
  coach: IncomingCoachInvitation["coach"] | null | undefined,
  fallback: string,
): string {
  return coach?.display_name ?? coach?.brand_name ?? fallback;
}

function InvitationRow({ invitation }: { invitation: IncomingCoachInvitation }) {
  const t = useTranslations("fighterInvitations");
  const format = useFormatter();
  const router = useRouter();
  const name = inviterName(invitation.coach, t("fallbackName"));
  const status = t(`status.${invitation.status}`);
  const day = (iso: string | null) => (iso ? format.dateTime(new Date(iso), "date") : "");

  if (invitation.status === "pending") {
    const brand = invitation.coach.display_name ? invitation.coach.brand_name : null;
    const date = day(invitation.expires_at);
    const line = brand ? t("row.pendingBrand", { brand, date }) : t("row.pending", { date });
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${status}, ${line}`}
        accessibilityHint={t("row.open")}
        onPress={() =>
          router.push(
            routeHref("mobile.profile.coaches.invitations._invitation-id", {
              invitationId: invitation.invitation_id,
            }),
          )
        }
        className="min-h-19 flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-3.5 py-3 active:bg-muted"
      >
        <Avatar name={name} />
        <View className="flex-1 gap-1">
          <Text variant="body" weight="extrabold" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="mutedForeground" numberOfLines={2}>
            {line}
          </Text>
          <Badge label={status} variant="accent" />
        </View>
        <Icon icon={ChevronRight} size={16} color="faintForeground" />
      </Pressable>
    );
  }

  // Answered, cancelled or expired: the date the backend reports, nothing to open.
  const line = t(`row.${invitation.status}`, {
    date: day(invitation.status === "expired" ? invitation.expires_at : invitation.responded_at),
  });
  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${status}, ${line}`}
      className="min-h-17 flex-row items-center gap-3 rounded-3xl border border-border bg-background px-3.5 py-3"
      testID={`invitation:${invitation.status}`}
    >
      <Avatar name={name} size="sm" />
      <View className="flex-1 gap-1">
        <Text variant="bodySm" weight="extrabold" color="mutedForeground" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="faintForeground">
          {line}
        </Text>
        <Badge label={status} />
      </View>
    </View>
  );
}
