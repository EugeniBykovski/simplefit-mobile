import { View, type ViewProps } from "react-native";

/** Raised container on the `surface` token. */
export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      {...props}
      className={`gap-3 rounded-lg border border-border bg-surface p-4 ${className ?? ""}`}
    />
  );
}
