import { View } from "react-native";

/** Decorative divider; invisible to assistive technology. */
export function Separator({
  orientation = "horizontal",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      className={`bg-border ${orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch"}`}
    />
  );
}
