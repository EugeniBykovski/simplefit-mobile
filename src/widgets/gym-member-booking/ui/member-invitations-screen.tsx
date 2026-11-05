import { useRouter } from "expo-router";
import { CircleAlert, CircleCheck, MailQuestion } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import {
  membershipProblem,
  useAnswerInboxInvitation,
  useMyGymInvitations,
  type GymInboxInvitation,
} from "@/features/gym-membership-manage";
import { withContinuation } from "@/shared/routes/continuation";
import { mobileGuards, routeHref } from "@/shared/routes/routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Notice } from "@/shared/ui/notice";
import { Screen } from "@/shared/ui/screen";
import { Skeleton } from "@/shared/ui/skeleton";
import { Text } from "@/shared/ui/text";

import { ConfirmSheet, useMembershipProblemText } from "./membership-parts";
import { MemberState, useScreenTitle } from "./parts";

/*
 * Gym invitations (`mobile.me.gyms.invitations`, SF-135). No board exists: FCI1's
 * inbox pattern with the E07 content (D-MOBILE-GYM-MEMBER-JOIN).
 *
 * This is where an E07 link leads (SF-80's decision): the app never holds the
 * link's token. The backend lists what was sent to this account's verified
 * addresses, so another account sees nothing, and a wrong account's way forward
 * is "Missing an invitation?", which verifies the address in place (FCI3). Opening
 * accepts nothing; accept and decline are explicit, by id, and every answer reads
 * the list again, so an expired, withdrawn or already answered one says so. Staff
 * and coach invitations are other domains and never appear.
 */
type Done = { kind: "accepted"; gym: string; gymId: string } | { kind: "declined"; gym: string };

export function MemberInvitationsScreen() {
  const t = useTranslations("gymMembership.invitations");
  const problemText = useMembershipProblemText();
  const router = useRouter();
  useScreenTitle("mobile/me/gyms/invitations");
  const inbox = useMyGymInvitations();
  const [done, setDone] = useState<Done | null>(null);
  const pending = inbox.invitations.filter((invitation) => invitation.status === "pending");
  const earlier = inbox.invitations.filter((invitation) => invitation.status !== "pending");

  useEffect(() => {
    if (done === null) return;
    AccessibilityInfo.announceForAccessibility(
      done.kind === "accepted"
        ? t("accepted.text", { gym: done.gym })
        : t("declined", { gym: done.gym }),
    );
  }, [done, t]);

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
      <Text variant="body" color="mutedForeground">
        {t("lead")}
      </Text>
      {done !== null ? (
        <View className="gap-2" testID={`member-inbox-done-${done.kind}`}>
          <Notice tone="olive" icon={CircleCheck}>
            {done.kind === "accepted"
              ? t("accepted.text", { gym: done.gym })
              : t("declined", { gym: done.gym })}
          </Notice>
          {done.kind === "accepted" ? (
            <Button
              variant="outline"
              label={t("accepted.action")}
              onPress={() =>
                router.push(routeHref("mobile.me.gyms._gym-id.classes", { gymId: done.gymId }))
              }
            />
          ) : null}
        </View>
      ) : null}
      {inbox.query.isError ? (
        <View className="gap-2">
          <View accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Notice tone="coral" icon={CircleAlert}>
              {problemText(membershipProblem(inbox.query.error))}
            </Notice>
          </View>
          <Button variant="outline" label={t("retry")} onPress={() => void inbox.query.refetch()} />
        </View>
      ) : !inbox.complete ? (
        <View
          accessible
          accessibilityLabel={t("loading")}
          accessibilityRole="progressbar"
          className="gap-2.5"
        >
          <Skeleton className="h-28 rounded-3xl" />
        </View>
      ) : (
        <>
          {pending.length === 0 ? (
            <MemberState
              title={t("empty.title")}
              body={t("empty.body")}
              action={
                <Button
                  label={t("empty.action")}
                  onPress={() => router.push(routeHref("mobile.me.gyms.join"))}
                />
              }
            />
          ) : (
            <View className="gap-2.5">
              {pending.map((invitation) => (
                <InvitationRow
                  key={invitation.invitation_id}
                  invitation={invitation}
                  onDone={setDone}
                />
              ))}
            </View>
          )}
          {earlier.length > 0 ? (
            <View className="gap-2.5">
              <Text variant="label" color="faintForeground" accessibilityRole="header">
                {t("earlier")}
              </Text>
              {earlier.map((invitation) => (
                <EarlierRow key={invitation.invitation_id} invitation={invitation} />
              ))}
            </View>
          ) : null}
        </>
      )}
      <MissingInvitation />
    </Screen>
  );
}

/** FCI1's "Missing an invitation?": the way forward for another address (SF-79). */
function MissingInvitation() {
  const t = useTranslations("gymMembership.invitations.missing");
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      testID="member-invitations-missing"
      onPress={() => router.push(routeHref("mobile.me.gyms.invitations.verify-email"))}
      className="min-h-16 flex-row items-center gap-3 rounded-3xl border border-border px-4 py-3"
    >
      <Icon icon={MailQuestion} size={20} color="mutedForeground" />
      <View className="flex-1 gap-0.5">
        <Text variant="bodySm" weight="extrabold">
          {t("title")}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {t("body")}
        </Text>
        <Text variant="caption" weight="extrabold" color="highlight">
          {t("action")}
        </Text>
      </View>
    </Pressable>
  );
}

function EarlierRow({ invitation }: { invitation: GymInboxInvitation }) {
  const t = useTranslations("gymMembership.invitations");
  const gym = invitation.gym.name ?? t("unnamedGym");
  const status = invitation.status as "accepted" | "declined" | "cancelled" | "expired";
  const line = t(`status.${status}.line`);
  return (
    <View
      accessible
      accessibilityLabel={`${gym}, ${line}`}
      className="flex-row items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="extrabold">
          {gym}
        </Text>
        <Text variant="caption" color="mutedForeground">
          {line}
        </Text>
      </View>
      <Badge
        variant={status === "accepted" ? "accent" : "neutral"}
        label={t(`status.${status}.label`)}
      />
    </View>
  );
}

function InvitationRow({
  invitation,
  onDone,
}: {
  invitation: GymInboxInvitation;
  onDone: (done: Done) => void;
}) {
  const t = useTranslations("gymMembership.invitations");
  const format = useFormatter();
  const router = useRouter();
  const text = useMembershipProblemText();
  const { accept, decline } = useAnswerInboxInvitation();
  const id = invitation.invitation_id;
  const gym = invitation.gym.name ?? t("unnamedGym");
  const busy = accept.isPending || decline.isPending;
  const problem = accept.isError ? membershipProblem(accept.error) : null;
  const inviter = invitation.invited_by.first_name;

  return (
    <View
      className="gap-3 rounded-3xl border border-border bg-surface px-5 py-4"
      testID={`member-invitation-${id}`}
    >
      <View className="gap-1">
        <Text variant="h3" accessibilityRole="header">
          {gym}
        </Text>
        {inviter ? (
          <Text variant="bodySm" color="mutedForeground">
            {t("invitedBy", { name: inviter })}
          </Text>
        ) : null}
        <Text variant="caption" color="faintForeground">
          {t("sentTo", { address: invitation.sent_to })}
        </Text>
        <Text variant="caption" color="faintForeground">
          {t("expires", { date: format.dateTime(new Date(invitation.expires_at), "date") })}
        </Text>
      </View>
      {problem !== null ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="gap-2">
          <Notice tone={problem.kind === "limited" ? "amber" : "coral"} icon={CircleAlert}>
            {text(problem)}
          </Notice>
          {problem.kind === "registration" ? (
            <Button
              variant="outline"
              label={t("finishAccount")}
              onPress={() =>
                router.push(
                  withContinuation(mobileGuards.entry, {
                    returnTo: routeHref("mobile.me.gyms.invitations") as string,
                  }),
                )
              }
            />
          ) : null}
        </View>
      ) : null}
      <Button
        label={accept.isPending ? t("accepting") : t("accept")}
        accessibilityHint={gym}
        loading={accept.isPending}
        disabled={decline.isPending}
        onPress={() =>
          accept.mutate(id, {
            onSuccess: (answer) => onDone({ kind: "accepted", gym, gymId: answer.gym_id }),
          })
        }
      />
      <ConfirmSheet
        title={t("decline.title")}
        body={t("decline.body", { gym })}
        keep={t("decline.keep")}
        confirm={t("decline.confirm")}
        pendingLabel={t("decline.pending")}
        closeLabel={t("decline.keep")}
        isPending={decline.isPending}
        problem={decline.isError ? text(membershipProblem(decline.error)) : null}
        onOpen={() => decline.reset()}
        onConfirm={(close) =>
          decline.mutate(id, {
            onSuccess: () => {
              close();
              onDone({ kind: "declined", gym });
            },
          })
        }
        trigger={(open) => (
          <Button
            variant="outline"
            label={t("decline.action")}
            accessibilityHint={gym}
            disabled={busy}
            onPress={open}
          />
        )}
      />
    </View>
  );
}
