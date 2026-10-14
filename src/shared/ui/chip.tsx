import { Check } from "lucide-react-native";
import { Pressable } from "react-native";

import { Icon } from "./icon";
import { Text } from "./text";

/**
 * The registration chip (Claude Design OF4, OC1, OC2; 40 pt): a radio by
 * default, a check box with `multiple`.
 */
export function Chip({
  label,
  checked,
  multiple = false,
  disabled = false,
  onPress,
}: {
  label: string;
  checked: boolean;
  multiple?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-3.5 ${checked ? "border-[1.5px] border-primary-muted bg-accent" : "border border-input"}`}
    >
      {checked ? <Icon icon={Check} size={14} color="accentForeground" /> : null}
      <Text
        variant="bodySm"
        weight={checked ? "extrabold" : "bold"}
        color={checked ? "accentForeground" : "mutedForeground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
