import { CircleAlert } from "lucide-react-native";
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Notice } from "@/shared/ui/notice";
import { Spinner } from "@/shared/ui/spinner";
import { Text } from "@/shared/ui/text";

import { isKnownEntry } from "../model/entry";
import { ContextChooser } from "./context-chooser";
import type { SwitchTarget } from "./context-switch";
import { useEntry } from "./entry-redirect";

const NO_CONTINUATION = {};

/**
 * A04 "One account, every role" (Claude Design Workspaces, mode `switch`,
 * version 1791994719-673f): the bottom sheet a home's identity pill opens.
 * It reads the entry fresh each time it opens, lists the account's profile
 * contexts and gym workspaces (SF-89) with `current` checked (a profile, or
 * `gym:<id>` from a Gym pulse), and closes with the backdrop, the current
 * row, the Android back button or the iOS dismiss gesture. Choosing another
 * context leaves through the SF-51 entry (useContextSwitch).
 */
export function ContextSwitcherSheet({
  visible,
  current,
  onClose,
}: {
  visible: boolean;
  current: SwitchTarget;
  onClose: () => void;
}) {
  const t = useTranslations("contextSwitcher");
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
          className="absolute inset-0 bg-overlay/70"
        />
        <View
          accessibilityViewIsModal
          className="gap-3.5 rounded-t-4xl border-t border-border-strong bg-surface px-5 pt-3"
          // Runtime safe-area insets: below the content, and the sheet never
          // taller than the window under the status bar (its rows scroll).
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 18,
            maxHeight: height - insets.top - 16,
          }}
        >
          <View className="h-1.5 w-10 self-center rounded-full bg-border-strong" />
          <View className="gap-1.5 pt-1">
            <Text variant="h3" accessibilityRole="header">
              {t("switch.title")}
            </Text>
            <Text variant="bodySm" color="mutedForeground">
              {t("switch.lead")}
            </Text>
          </View>
          <ScrollView className="flex-shrink" contentContainerClassName="gap-3.5">
            {visible ? <SheetBody current={current} onClose={onClose} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SheetBody({ current, onClose }: { current: SwitchTarget; onClose: () => void }) {
  const t = useTranslations("contextSwitcher");
  const query = useEntry(NO_CONTINUATION);
  const entry = query.data;

  if (query.isError || (entry !== undefined && !isKnownEntry(entry))) {
    return (
      <View className="gap-3">
        <View accessibilityRole="alert">
          <Notice tone="coral" icon={CircleAlert}>
            {t("loadFailed")}
          </Notice>
        </View>
        <Button label={t("retry")} variant="quiet" onPress={() => void query.refetch()} />
      </View>
    );
  }
  if (entry === undefined) {
    return (
      <View className="min-h-32 items-center justify-center">
        <Spinner label={t("loading")} />
      </View>
    );
  }
  return (
    <ContextChooser
      entry={entry}
      mode={{ kind: "switch", current }}
      onCurrent={onClose}
      onLeave={onClose}
    />
  );
}
