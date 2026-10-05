import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal as RNModal, Pressable, View } from "react-native";

import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Centered dialog on the overlay token. Closes via the close button, the
 * backdrop, or the Android back button / iOS gesture (onRequestClose). The
 * title is announced as a header; `closeLabel` is required (no built-in copy).
 */
export function Modal({
  visible,
  onClose,
  title,
  description,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  children?: ReactNode;
}) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          className="absolute inset-0 bg-overlay/70"
        />
        <View
          accessibilityViewIsModal
          className="w-full max-w-md gap-4 rounded-2xl border border-border bg-surface-elevated p-6"
        >
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-1">
              <Text variant="h3">{title}</Text>
              {description ? <Text color="mutedForeground">{description}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={onClose}
              hitSlop={8}
              className="size-9 items-center justify-center rounded-full active:bg-muted"
            >
              <Icon icon={X} color="mutedForeground" />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}
