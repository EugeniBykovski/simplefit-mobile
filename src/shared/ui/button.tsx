import { ActivityIndicator, Pressable, View } from "react-native";

import { useTheme } from "@/shared/styles/theme";
import type { SemanticColors } from "@/shared/styles/tokens";

import { Icon, type IconName } from "./icon";
import { Text, type TextColor } from "./text";

type Variant = "primary" | "secondary" | "ghost";

export type ButtonProps = {
  /** Visible text and accessible name. */
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  /** Shows a spinner, disables presses and reports "busy" to assistive tech. */
  loading?: boolean;
  /** Extra context read after the label (e.g. what will happen). */
  accessibilityHint?: string;
  testID?: string;
};

const variants: Record<Variant, { container: string; text: TextColor & keyof SemanticColors }> = {
  primary: { container: "bg-primary border-primary", text: "primaryForeground" },
  secondary: { container: "bg-secondary border-secondary", text: "secondaryForeground" },
  ghost: { container: "bg-background border-border", text: "foreground" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const tone = variants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={4}
      testID={testID}
      className={`min-h-touch items-center justify-center rounded-md border px-4 active:opacity-80 ${tone.container} ${inactive ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        {loading ? (
          <ActivityIndicator color={colors[tone.text]} />
        ) : (
          icon && <Icon name={icon} color={tone.text} />
        )}
        <Text variant="label" color={tone.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
