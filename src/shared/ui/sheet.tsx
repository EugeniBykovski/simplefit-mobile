import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./text";

/**
 * Bottom sheet on the overlay token, as the design draws confirmations and
 * short forms on mobile (A04, C03, C04). Closes via the backdrop, the Android
 * back button or the iOS gesture (`onRequestClose`) unless `dismissible` is
 * false (a request in flight). The title is announced as a header;
 * `closeLabel` names the backdrop (no built-in copy). Content scrolls and
 * stays above the keyboard.
 */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  closeLabel,
  dismissible = true,
  role,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  dismissible?: boolean;
  /** `alert` for a confirmation of a consequential action. */
  role?: "alert";
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={close}
          className="absolute inset-0 bg-overlay/70"
        />
        <View
          accessibilityViewIsModal
          accessibilityRole={role}
          className="max-h-full rounded-t-4xl border-t border-border-strong bg-surface px-5 pt-3"
          // Runtime safe-area inset below the sheet's content.
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 18 }}
        >
          <View className="mb-3.5 h-1.5 w-10 self-center rounded-full bg-border-strong" />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3.5">
            <View className="gap-1.5 pt-1">
              <Text variant="h3" accessibilityRole="header">
                {title}
              </Text>
              {description ? (
                <Text variant="bodySm" color="mutedForeground">
                  {description}
                </Text>
              ) : null}
            </View>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
