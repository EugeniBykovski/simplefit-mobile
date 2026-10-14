import { View, Pressable } from "react-native";

import { FieldError } from "@/shared/ui/field-error";
import { Text } from "@/shared/ui/text";

/*
 * The OF2 stance switch (Claude Design FIGHTER 2). The other registration
 * controls (choice card, chip, country field) are shared with the Coach
 * registration (`@/shared/ui`).
 */

/** OF2 stance: three equal segments in a pill well; none chosen until the person picks. */
export function SegmentChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | undefined;
}) {
  return (
    <View className="gap-2">
      <Text variant="label" color="faintForeground">
        {label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className={`flex-row gap-1 rounded-3xl bg-surface p-1 ${error ? "border-2 border-destructive" : "border border-border"}`}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              onPress={() => onChange(option.value)}
              className={`min-h-9 flex-1 items-center justify-center rounded-full ${checked ? "bg-secondary" : ""}`}
            >
              <Text
                variant="caption"
                weight={checked ? "extrabold" : "bold"}
                color={checked ? "secondaryForeground" : "mutedForeground"}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}
