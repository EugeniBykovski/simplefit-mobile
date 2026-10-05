import { Pressable, View } from "react-native";

import { Text } from "./text";

export type Segment<T extends string> = { value: T; label: string };

/**
 * Tabs / segmented control for switching between views of the same content.
 * Exposed as a tab list; the selected tab is shown by fill and weight.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
}: {
  /** Accessible name of the tab list. */
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className="flex-row gap-1 rounded-full border border-border bg-surface p-1"
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            className={`min-h-touch flex-1 items-center justify-center rounded-full px-3 ${selected ? "bg-secondary" : "active:bg-muted"}`}
          >
            <Text
              variant="caption"
              weight={selected ? "extrabold" : "bold"}
              color={selected ? "primaryForeground" : "mutedForeground"}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
