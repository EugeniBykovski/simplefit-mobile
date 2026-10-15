import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { Notice } from "@/shared/ui/notice";

import { useEndMyCoach, type EndOutcome } from "../model/end-relationship";

/**
 * "End relationship" and its confirmation (FC2, Claude Design
 * 1792069267-b198). The relationship ends only when the fighter confirms and
 * the backend has answered; while the request runs the dialog cannot be
 * dismissed or confirmed twice. A failure keeps the dialog open with the
 * reason and changes nothing.
 */
export function EndRelationshipButton({
  relationshipId,
  coachName,
  onDone,
}: {
  relationshipId: string;
  coachName: string;
  onDone: (outcome: EndOutcome) => void;
}) {
  const t = useTranslations("fighterCoaches.end");
  const [open, setOpen] = useState(false);
  const end = useEndMyCoach();
  const pending = end.isPending;

  const close = () => {
    if (pending) return;
    end.reset();
    setOpen(false);
  };

  return (
    <>
      <Button label={t("action")} variant="destructiveSubtle" onPress={() => setOpen(true)} />
      <Modal
        visible={open}
        onClose={close}
        title={t("title", { name: coachName })}
        description={t("body", { name: coachName })}
        closeLabel={t("keep")}
      >
        <View className="gap-3">
          {end.isError ? (
            <Notice tone="coral" icon={CircleAlert}>
              {t("failed")}
            </Notice>
          ) : null}
          <Button
            label={pending ? t("pending") : t("confirm")}
            variant="destructive"
            loading={pending}
            disabled={pending}
            onPress={() =>
              end.mutate(relationshipId, {
                onSuccess: (outcome) => {
                  setOpen(false);
                  onDone(outcome);
                },
              })
            }
          />
          <Button label={t("keep")} variant="quiet" disabled={pending} onPress={close} />
        </View>
      </Modal>
    </>
  );
}
