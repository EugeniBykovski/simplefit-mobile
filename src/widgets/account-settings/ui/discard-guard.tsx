import { useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";

/**
 * Asks before leaving a form with unsaved edits (Back, the iOS swipe, the
 * Android back button): Discard leaves, Keep editing stays. Saving or an
 * unchanged form leaves freely.
 */
export function DiscardGuard({ active }: { active: boolean }) {
  const t = useTranslations("accountSettings.discard");
  const navigation = useNavigation();
  // The leave that was held back, replayed by Discard.
  const [pending, setPending] = useState<() => void>();
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!activeRef.current) return;
        event.preventDefault();
        setPending(() => () => navigation.dispatch(event.data.action));
      }),
    [navigation],
  );

  return (
    <Modal
      visible={pending !== undefined}
      onClose={() => setPending(undefined)}
      title={t("title")}
      description={t("body")}
      closeLabel={t("keep")}
    >
      <View className="gap-2.5">
        <Button
          label={t("discard")}
          variant="destructive"
          onPress={() => {
            const leave = pending;
            activeRef.current = false;
            setPending(undefined);
            leave?.();
          }}
        />
        <Button label={t("keep")} variant="quiet" onPress={() => setPending(undefined)} />
      </View>
    </Modal>
  );
}
