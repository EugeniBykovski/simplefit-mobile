import { Switch as RNSwitch, View } from "react-native";

import { useTheme } from "@/shared/styles/theme";

import { Text } from "./text";

/** Labelled native switch. Track/thumb colours are native props (theme values). */
export function Switch({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View
      className={`min-h-touch flex-row items-center justify-between gap-3 ${disabled ? "opacity-50" : ""}`}
    >
      <Text
        weight="medium"
        className="flex-1"
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {label}
      </Text>
      <RNSwitch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.input, true: colors.primary }}
        thumbColor={colors.secondary}
        ios_backgroundColor={colors.input}
      />
    </View>
  );
}
