import { ActivityIndicator } from "react-native";

import { useTheme } from "@/shared/styles/theme";

/** Loading indicator; the label is announced (e.g. "Loading training plans"). */
export function Spinner({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <ActivityIndicator
      accessible
      // Native prop: the indicator colour cannot be set with a className.
      color={colors.mutedForeground}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    />
  );
}
