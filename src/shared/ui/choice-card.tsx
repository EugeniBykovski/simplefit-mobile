import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import { Text } from "./text";

/**
 * The registration choice card (Claude Design OF2, OF3, OC2): 20 pt radius, a
 * title and a line, an optional badge, and a radio ring or a check box.
 * Selection is shown by border weight and the mark as well as colour, and
 * announced as checked.
 */
export function ChoiceCard({
  title,
  body,
  checked,
  multiple = false,
  badge,
  onPress,
  disabled = false,
}: {
  title: string;
  body: string;
  checked: boolean;
  multiple?: boolean;
  badge?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-touch flex-row items-center gap-3 rounded-2xl px-4 py-3.5 ${checked ? "border-[1.5px] border-highlight bg-accent" : "border border-border bg-surface"}`}
    >
      <View className="flex-1 gap-0.5">
        <Text
          variant="bodyLg"
          weight="extrabold"
          color={checked ? "accentForeground" : "foreground"}
        >
          {title}
        </Text>
        <Text variant="caption" color={checked ? "accentMutedForeground" : "mutedForeground"}>
          {body}
        </Text>
      </View>
      {badge}
      {multiple ? (
        <View
          className={`size-5.5 items-center justify-center rounded-xs ${checked ? "bg-highlight" : "border-2 border-border-strong"}`}
        >
          {checked ? <Icon icon={Check} size={14} color="highlightForeground" /> : null}
        </View>
      ) : (
        <View
          className={`size-5.5 items-center justify-center rounded-full border-2 ${checked ? "border-highlight" : "border-border-strong"}`}
        >
          {checked ? <View className="size-2.5 rounded-full bg-highlight" /> : null}
        </View>
      )}
    </Pressable>
  );
}
