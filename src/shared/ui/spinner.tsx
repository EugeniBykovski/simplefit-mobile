import { ActivityIndicator } from "react-native";

import { useTheme } from "@/shared/styles/theme";

/**
 * Loading indicator for short or indeterminate waits; prefer Skeleton for
 * content that takes longer than ~300 ms. The label is announced
 * (e.g. "Loading training plans").
 */
export function Spinner({ label, size = "small" }: { label: string; size?: "small" | "large" }) {
  const { colors } = useTheme();
  return (
    <ActivityIndicator
      accessible
      size={size}
      // Native prop: the indicator colour cannot be set with a className.
      color={colors.primary}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    />
  );
}
