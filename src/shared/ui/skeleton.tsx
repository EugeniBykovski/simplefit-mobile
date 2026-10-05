import { View } from "react-native";

/**
 * Placeholder block shown while content loads (> 300 ms waits). Static: no
 * shimmer animation, so it respects reduced motion by default. Hidden from
 * assistive technology; pair it with a labelled Spinner or live-region text
 * describing what is loading.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className={`rounded-md bg-muted ${className ?? ""}`}
    />
  );
}
