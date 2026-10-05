import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { useTheme } from "@/shared/styles/theme";
import type { SemanticColors } from "@/shared/styles/tokens";

export type { LucideIcon };

/**
 * The app's single icon set: Lucide (same set and version as the web app).
 * Icons are decorative and hidden from assistive technology: meaning must also
 * be carried by text or the parent's accessibility label. The glyph colour is
 * a native prop, so it reads the token value from useTheme().
 */
export function Icon({
  icon: Glyph,
  size = 18,
  color = "foreground",
}: {
  icon: LucideIcon;
  size?: number;
  color?: keyof SemanticColors;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Glyph size={size} color={colors[color]} strokeWidth={2} />
    </View>
  );
}
