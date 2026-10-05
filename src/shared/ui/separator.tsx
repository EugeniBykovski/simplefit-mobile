import { View } from "react-native";

/** Decorative divider; invisible to assistive technology. */
export function Separator() {
  return <View accessible={false} importantForAccessibility="no" className="h-px bg-border" />;
}
