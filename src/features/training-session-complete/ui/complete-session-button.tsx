import { Check, CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";

import { useCompleteTrainingSession, type CompleteOutcome } from "../model/complete-session";

/**
 * "Mark as completed" and its confirmation sheet (FT2 sheet=confirm|pending|
 * failed, Claude Design 1792569354-73b2). The fighter's explicit action: one
 * request, only after they confirm, never on a timer. While it runs the sheet
 * cannot be dismissed or confirmed twice. Without an answer it says the
 * session may already be saved and keeps the sheet open: trying again is
 * safe, the backend completes a session once.
 */
export function CompleteSessionButton({
  sessionId,
  coachName,
  onDone,
}: {
  sessionId: string;
  /** The coach's disclosed name, or `null` when there is none to show. */
  coachName: string | null;
  onDone: (outcome: CompleteOutcome) => void;
}) {
  const t = useTranslations("fighterTraining.complete");
  const [open, setOpen] = useState(false);
  const complete = useCompleteTrainingSession(sessionId);
  const pending = complete.isPending;
  const close = () => {
    complete.reset();
    setOpen(false);
  };

  return (
    <>
      <Button
        label={t("action")}
        icon={Check}
        size="lg"
        onPress={() => setOpen(true)}
        testID="training:complete"
      />
      <Sheet
        visible={open}
        role="alert"
        dismissible={!pending}
        onClose={close}
        title={t("title")}
        description={coachName === null ? t("bodyUnnamed") : t("body", { name: coachName })}
        closeLabel={t("keep")}
      >
        {complete.isError ? (
          <View accessibilityRole="alert">
            <Notice tone="coral" icon={CircleAlert}>
              {t("failed")}
            </Notice>
          </View>
        ) : null}
        <Button
          label={pending ? t("pending") : t("confirm")}
          loading={pending}
          disabled={pending}
          onPress={() =>
            complete.mutate(undefined, {
              onSuccess: (outcome) => {
                setOpen(false);
                onDone(outcome);
              },
            })
          }
          testID="training:complete:confirm"
        />
        <Button label={t("keep")} variant="quiet" disabled={pending} onPress={close} />
      </Sheet>
    </>
  );
}
