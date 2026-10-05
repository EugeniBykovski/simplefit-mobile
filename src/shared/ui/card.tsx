import { View, type ViewProps } from "react-native";

/**
 * Container on the `surface` token with a hairline border. Canonical card:
 * radius 3xl (22 pt), padding 18 × 20; `compact` card: radius 2xl (20 pt),
 * padding 14 × 16 (docs/design-tokens.json controls.card). `elevated` lifts it
 * onto surface-elevated for nested emphasis.
 */
export function Card({
  className,
  elevated = false,
  compact = false,
  ...props
}: ViewProps & { elevated?: boolean; compact?: boolean }) {
  return (
    <View
      {...props}
      className={`border border-border ${compact ? "gap-2.5 rounded-2xl px-4 py-3.5" : "gap-3 rounded-3xl px-5 py-4.5"} ${elevated ? "bg-surface-elevated" : "bg-surface"} ${className ?? ""}`}
    />
  );
}
