import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { CoachInvitation } from "@/entities/coach-invitation";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";
import { useToast } from "@/shared/ui/toast";

import {
  actionProblem,
  useInvitationActions,
  type ActionProblem,
} from "../model/invitation-actions";

/**
 * Resend and Cancel of a pending invitation (C03 Invitations, Claude Design
 * 1792155768-3179). Resend shows only while the backend reports resends
 * left; Cancel asks first. One request at a time; outcomes are toasts, a
 * failed cancel keeps its sheet open.
 */
export function InvitationActions({ invitation }: { invitation: CoachInvitation }) {
  const t = useTranslations("coachFighters");
  const toast = useToast();
  const { resend, cancel } = useInvitationActions();
  const [confirming, setConfirming] = useState(false);
  const email = invitation.recipient_email;

  const problemText = (problem: ActionProblem) =>
    problem.kind === "cooldown"
      ? t("results.cooldown", { seconds: problem.seconds })
      : t(`results.${problem.kind}`);

  return (
    <View className="flex-row flex-wrap gap-2 pt-1">
      {invitation.resends_remaining > 0 ? (
        <Button
          label={
            resend.isPending
              ? t("invitations.resending")
              : t("invitations.resend", { count: invitation.resends_remaining })
          }
          variant="quiet"
          size="sm"
          loading={resend.isPending}
          disabled={resend.isPending || cancel.isPending}
          onPress={() =>
            resend.mutate(invitation.invitation_id, {
              onSuccess: () =>
                toast.show({ title: t("results.resent", { email }), tone: "success" }),
              onError: (error) =>
                toast.show({ title: problemText(actionProblem(error)), tone: "warning" }),
            })
          }
        />
      ) : null}
      <Button
        label={t("invitations.cancel")}
        variant="destructiveSubtle"
        size="sm"
        disabled={resend.isPending || cancel.isPending}
        onPress={() => setConfirming(true)}
      />
      <Sheet
        visible={confirming}
        role="alert"
        dismissible={!cancel.isPending}
        onClose={() => {
          cancel.reset();
          setConfirming(false);
        }}
        title={t("cancelInvitation.title")}
        description={t("cancelInvitation.body", { email })}
        closeLabel={t("cancelInvitation.keep")}
      >
        {cancel.isError && actionProblem(cancel.error).kind === "failed" ? (
          <View accessibilityRole="alert">
            <Notice tone="coral" icon={CircleAlert}>
              {t("cancelInvitation.failed")}
            </Notice>
          </View>
        ) : null}
        <Button
          label={cancel.isPending ? t("cancelInvitation.pending") : t("cancelInvitation.confirm")}
          variant="destructive"
          loading={cancel.isPending}
          disabled={cancel.isPending}
          onPress={() =>
            cancel.mutate(invitation.invitation_id, {
              onSuccess: () => {
                setConfirming(false);
                toast.show({ title: t("results.cancelled", { email }), tone: "success" });
              },
              onError: (error) => {
                const problem = actionProblem(error);
                if (problem.kind === "failed") return;
                setConfirming(false);
                toast.show({ title: problemText(problem), tone: "warning" });
              },
            })
          }
        />
        <Button
          label={t("cancelInvitation.keep")}
          variant="quiet"
          disabled={cancel.isPending}
          onPress={() => setConfirming(false)}
        />
      </Sheet>
    </View>
  );
}
