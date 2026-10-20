import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";

import { useCancelTrainingSession, type CancelOutcome } from "../model/cancel-session";

/**
 * "Cancel session" and its confirmation sheet (CT3 sheet=confirm|pending|
 * failed, Claude Design 1792504884-2e4e). One request, only after the coach
 * confirms; while it runs the sheet cannot be dismissed or confirmed twice.
 * A failure keeps the sheet open and changes nothing.
 */
export function CancelSessionButton({
  sessionId,
  fighterName,
  onDone,
}: {
  sessionId: string;
  /** The fighter's disclosed name, or `null` when it is not shared. */
  fighterName: string | null;
  onDone: (outcome: CancelOutcome) => void;
}) {
  const t = useTranslations("coachSessions.cancelDialog");
  const [open, setOpen] = useState(false);
  const cancel = useCancelTrainingSession(sessionId);
  const pending = cancel.isPending;
  const close = () => {
    cancel.reset();
    setOpen(false);
  };

  return (
    <>
      <Button
        label={t("confirm")}
        variant="destructiveSubtle"
        onPress={() => setOpen(true)}
        testID="session:cancel"
      />
      <Sheet
        visible={open}
        role="alert"
        dismissible={!pending}
        onClose={close}
        title={t("title")}
        description={fighterName === null ? t("bodyUnnamed") : t("body", { name: fighterName })}
        closeLabel={t("keep")}
      >
        {cancel.isError ? (
          <View accessibilityRole="alert">
            <Notice tone="coral" icon={CircleAlert}>
              {t("failed")}
            </Notice>
          </View>
        ) : null}
        <Button
          label={pending ? t("pending") : t("confirm")}
          variant="destructive"
          loading={pending}
          disabled={pending}
          onPress={() =>
            cancel.mutate(undefined, {
              onSuccess: (outcome) => {
                setOpen(false);
                onDone(outcome);
              },
            })
          }
          testID="session:cancel:confirm"
        />
        <Button label={t("keep")} variant="quiet" disabled={pending} onPress={close} />
      </Sheet>
    </>
  );
}
