import { View } from "react-native";

import { Icon, type LucideIcon } from "./icon";
import { Text, type TextColor } from "./text";

export type BadgeVariant =
  "neutral" | "primary" | "accent" | "success" | "warning" | "destructive" | "info";

const variants: Record<BadgeVariant, { container: string; text: TextColor }> = {
  neutral: { container: "bg-muted", text: "mutedForeground" },
  primary: { container: "bg-primary", text: "primaryForeground" },
  accent: { container: "bg-accent", text: "accentForeground" },
  success: { container: "bg-success-subtle", text: "successSubtleForeground" },
  warning: { container: "bg-warning-subtle", text: "warningSubtleForeground" },
  destructive: { container: "bg-destructive-subtle", text: "destructiveSubtleForeground" },
  info: { container: "bg-info-subtle", text: "infoSubtleForeground" },
};

/**
 * Status pill (same variants as web). The label always states the status;
 * amber = attention, coral = failure, olive = positive/progress.
 */
export function Badge({
  label,
  variant = "neutral",
  icon,
}: {
  label: string;
  variant?: BadgeVariant;
  icon?: LucideIcon;
}) {
  const tone = variants[variant];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${tone.container}`}
    >
      {icon ? <Icon icon={icon} size={12} color={tone.text} /> : null}
      <Text variant="caption" weight="bold" color={tone.text} className="uppercase tracking-wide">
        {label}
      </Text>
    </View>
  );
}
