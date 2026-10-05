import { ActivityIndicator, Pressable, View } from "react-native";

import { useTheme } from "@/shared/styles/theme";
import type { SemanticColors } from "@/shared/styles/tokens";

import { Icon, type LucideIcon } from "./icon";
import { Text, type TextColor } from "./text";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "gym";

export type ButtonProps = {
  /** Visible text and accessible name. */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Shows a spinner, disables presses and reports "busy" to assistive tech. */
  loading?: boolean;
  /** Extra context read after the label (e.g. what will happen). */
  accessibilityHint?: string;
  testID?: string;
};

// One olive primary action per screen (design principle "Olive = action").
const variants: Record<
  ButtonVariant,
  { container: string; text: TextColor & keyof SemanticColors }
> = {
  primary: { container: "bg-primary border-primary", text: "primaryForeground" },
  secondary: { container: "bg-secondary border-secondary", text: "secondaryForeground" },
  outline: { container: "bg-transparent border-primary/70", text: "primary" },
  ghost: { container: "bg-transparent border-transparent", text: "foreground" },
  destructive: { container: "bg-destructive border-destructive", text: "destructiveForeground" },
};

// Touch targets: sm keeps 44 pt with hitSlop; gym = 60 pt (gym mode).
const sizes: Record<ButtonSize, { container: string; textVariant: "bodySmall" | "body" }> = {
  sm: { container: "min-h-9 px-3", textVariant: "bodySmall" },
  md: { container: "min-h-touch px-4", textVariant: "body" },
  lg: { container: "min-h-14 px-6", textVariant: "body" },
  gym: { container: "min-h-touch-gym px-6", textVariant: "body" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const tone = variants[variant];
  const scale = sizes[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={size === "sm" ? 6 : 4}
      testID={testID}
      className={`items-center justify-center rounded-md border active:opacity-80 ${tone.container} ${scale.container} ${inactive ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        {loading ? (
          <ActivityIndicator color={colors[tone.text]} />
        ) : (
          icon && <Icon icon={icon} color={tone.text} />
        )}
        <Text variant={scale.textVariant} weight="bold" color={tone.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
