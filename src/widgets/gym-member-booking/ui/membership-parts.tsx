import { CircleAlert } from "lucide-react-native";
import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { MembershipProblem } from "@/features/gym-membership-manage";
import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";

/** The sentence for a refused or unconfirmed membership action. */
export function useMembershipProblemText() {
  const t = useTranslations("gymMembership.problems");
  return useCallback(
    (problem: MembershipProblem) => {
      if (problem.kind !== "limited") return t(problem.kind);
      return problem.minutes === null
        ? t("limitedLater")
        : t("limited", { minutes: problem.minutes });
    },
    [t],
  );
}

/**
 * A membership action that is always asked first, in the app's alert sheet.
 * Nothing changes until the backend answers; a refusal stays here, so the person
 * sees why. Android Back and the scrim dismiss it unless a request is running.
 */
export function ConfirmSheet({
  title,
  body,
  keep,
  confirm,
  pendingLabel,
  closeLabel,
  isPending,
  problem,
  onConfirm,
  trigger,
  onOpen,
}: {
  title: string;
  body: string;
  keep: string;
  confirm: string;
  pendingLabel: string;
  closeLabel: string;
  isPending: boolean;
  problem: string | null;
  onConfirm: (close: () => void) => void;
  trigger: (open: () => void) => ReactNode;
  onOpen?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const close = () => setVisible(false);
  return (
    <>
      {trigger(() => {
        onOpen?.();
        setVisible(true);
      })}
      <Sheet
        visible={visible}
        onClose={close}
        dismissible={!isPending}
        title={title}
        description={body}
        closeLabel={closeLabel}
        role="alert"
      >
        <View className="gap-2.5">
          {problem !== null ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Notice tone="coral" icon={CircleAlert}>
                {problem}
              </Notice>
            </View>
          ) : null}
          <Button
            variant="destructive"
            label={isPending ? pendingLabel : confirm}
            loading={isPending}
            onPress={() => onConfirm(close)}
          />
          <Button variant="outline" label={keep} disabled={isPending} onPress={close} />
        </View>
      </Sheet>
    </>
  );
}
