import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "./icon";
import { Text } from "./text";

/** Labelled checkbox; checked state is shown by a check mark, not colour alone. */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={`min-h-touch flex-row items-center gap-3 ${disabled ? "opacity-50" : ""}`}
    >
      <View
        className={`size-6 items-center justify-center rounded-xs border-2 ${checked ? "border-primary bg-primary" : "border-input bg-transparent"}`}
      >
        {checked ? <Icon icon={Check} size={16} color="primaryForeground" /> : null}
      </View>
      <View className="flex-1">
        <Text weight="bold">{label}</Text>
        {description ? (
          <Text variant="caption" color="faintForeground">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
