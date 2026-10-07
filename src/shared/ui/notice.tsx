import type { ReactNode } from "react";
import { View } from "react-native";

import type { SemanticColors } from "@/shared/styles/tokens";

import { Icon, type LucideIcon } from "./icon";
import { Text, type TextColor } from "./text";

export type NoticeTone = "olive" | "amber" | "coral" | "muted";

/*
 * The inline status box of the auth screens (Claude Design O01c, O02, O03): a
 * 16 pt icon and caption text on a tinted, bordered well, radius `lg`,
 * padding 12 × 14. Olive confirms, amber asks for action, coral reports an
 * error, muted guides.
 */
const tones: Record<NoticeTone, { box: string; text: TextColor; icon: keyof SemanticColors }> = {
  olive: { box: "border-accent-border bg-accent", text: "accentForeground", icon: "highlight" },
  amber: {
    box: "border-warning-border bg-warning-subtle",
    text: "warningSubtleForeground",
    icon: "warning",
  },
  coral: {
    box: "border-destructive-border bg-destructive-subtle",
    text: "destructiveSubtleForeground",
    icon: "destructive",
  },
  muted: {
    box: "border-input bg-surface-elevated",
    text: "mutedForeground",
    icon: "faintForeground",
  },
};

export function Notice({
  tone = "muted",
  icon,
  children,
  live = false,
}: {
  tone?: NoticeTone;
  icon: LucideIcon;
  children: ReactNode;
  /** Announce changes politely (status messages). */
  live?: boolean;
}) {
  const style = tones[tone];
  return (
    <View
      accessible
      accessibilityLiveRegion={live ? "polite" : "none"}
      className={`flex-row items-start gap-2.5 rounded-lg border px-3.5 py-3 ${style.box}`}
    >
      <View className="mt-px">
        <Icon icon={icon} size={16} color={style.icon} />
      </View>
      <Text variant="caption" color={style.text} className="flex-1">
        {children}
      </Text>
    </View>
  );
}
