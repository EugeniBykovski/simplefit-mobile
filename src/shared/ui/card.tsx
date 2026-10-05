import { View, type ViewProps } from "react-native";

/**
 * Container on the `surface` token (radius xl = 22 pt, per the visual system).
 * `elevated` lifts it onto surface-elevated for nested emphasis.
 */
export function Card({
  className,
  elevated = false,
  ...props
}: ViewProps & { elevated?: boolean }) {
  return (
    <View
      {...props}
      className={`gap-3 rounded-xl border border-border p-5 ${elevated ? "bg-surface-elevated" : "bg-surface"} ${className ?? ""}`}
    />
  );
}
