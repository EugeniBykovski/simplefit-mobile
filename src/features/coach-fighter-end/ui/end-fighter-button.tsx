import { CircleAlert } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Sheet } from "@/shared/ui/sheet";

import { useEndCoachFighter, type EndOutcome } from "../model/end-relationship";

/**
 * "End relationship" and its confirmation (C04, Claude Design
 * 1792155768-3179). Ends only after the coach confirms and the backend
 * answers; while the request runs the sheet cannot be dismissed or
 * confirmed twice. A failure keeps the sheet open and changes nothing.
 */
export function EndFighterButton({
  relationshipId,
  fighterName,
  onDone,
}: {
  relationshipId: string;
  fighterName: string;
  onDone: (outcome: EndOutcome) => void;
}) {
  const t = useTranslations("coachFighters.end");
  const [open, setOpen] = useState(false);
  const end = useEndCoachFighter();
  const pending = end.isPending;
  const close = () => {
    end.reset();
    setOpen(false);
  };

  return (
    <>
      <Button label={t("action")} variant="destructiveSubtle" onPress={() => setOpen(true)} />
      <Sheet
        visible={open}
        role="alert"
        dismissible={!pending}
        onClose={close}
        title={t("title", { name: fighterName })}
        description={t("body", { name: fighterName })}
        closeLabel={t("keep")}
      >
        {end.isError ? (
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
            end.mutate(relationshipId, {
              onSuccess: (outcome) => {
                setOpen(false);
                onDone(outcome);
              },
            })
          }
        />
        <Button label={t("keep")} variant="quiet" disabled={pending} onPress={close} />
      </Sheet>
    </>
  );
}
