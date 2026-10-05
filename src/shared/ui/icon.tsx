import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import { useTheme } from "@/shared/styles/theme";
import type { SemanticColors } from "@/shared/styles/tokens";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The app's single icon set (Ionicons via @expo/vector-icons). Icons are
 * decorative: hidden from assistive technology, so meaning must also be
 * carried by text or the parent's accessibility label. The glyph colour is a
 * native prop, so it reads the token value from useTheme().
 */
export function Icon({
  name,
  size = 18,
  color = "foreground",
}: {
  name: IconName;
  size?: number;
  color?: keyof SemanticColors;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={colors[color]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}
