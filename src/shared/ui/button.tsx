import { ActivityIndicator, Pressable, View } from "react-native";

import { useTheme } from "@/shared/styles/theme";
import type { SemanticColors } from "@/shared/styles/tokens";

import { Icon, type LucideIcon } from "./icon";
import { Text, type TextColor } from "./text";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "outline" | "ghost" | "destructive" | "destructiveSubtle";
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

/*
 * Variants follow the canonical design (docs/design-tokens.json): one olive
 * `primary` action per screen, `secondary` (bone) for the strong neutral
 * action, `quiet` (graphite) for everyday secondary actions, `outline` for a
 * quiet olive action, `ghost` for low-emphasis text actions, `destructive`
 * and `destructiveSubtle` (tinted coral) for irreversible ones.
 */
const variants: Record<
  ButtonVariant,
  { container: string; text: TextColor & keyof SemanticColors }
> = {
  primary: { container: "bg-primary border-primary", text: "primaryForeground" },
  secondary: { container: "bg-secondary border-secondary", text: "secondaryForeground" },
  quiet: { container: "bg-surface-elevated border-input", text: "foreground" },
  outline: { container: "bg-transparent border-primary-muted", text: "highlight" },
  ghost: { container: "bg-transparent border-transparent", text: "mutedForeground" },
  destructive: { container: "bg-destructive border-destructive", text: "destructiveForeground" },
  destructiveSubtle: {
    container: "bg-destructive-subtle border-destructive-border",
    text: "destructiveSubtleForeground",
  },
};

/*
 * Canonical mobile control sizes (docs/design-tokens.json controls.button.mobile):
 * sm 36 pt pill (touch target extended to 44 pt with hitSlop), md 50, lg 56
 * (the main call to action), gym 60 (gym mode). Labels are Manrope 800.
 */
const sizes: Record<ButtonSize, { container: string; textVariant: "bodySm" | "body" | "bodyLg" }> =
  {
    sm: { container: "min-h-button-sm rounded-full px-3.5", textVariant: "bodySm" },
    md: { container: "min-h-button-md rounded-xl px-4.5", textVariant: "body" },
    lg: { container: "min-h-button-lg rounded-xl px-4.5", textVariant: "bodyLg" },
    gym: { container: "min-h-touch-gym rounded-2xl px-6", textVariant: "bodyLg" },
  };

/** Extra touch area so every button reaches the 44 pt minimum target. */
const hitSlop: Record<ButtonSize, number> = { sm: 4, md: 0, lg: 0, gym: 0 };

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
      hitSlop={hitSlop[size]}
      testID={testID}
      className={`items-center justify-center border active:opacity-80 ${tone.container} ${scale.container} ${inactive ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        {loading ? (
          <ActivityIndicator color={colors[tone.text]} />
        ) : (
          icon && <Icon icon={icon} color={tone.text} />
        )}
        <Text variant={scale.textVariant} weight="extrabold" color={tone.text}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
