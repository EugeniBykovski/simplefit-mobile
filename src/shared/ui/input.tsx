import { useId, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/shared/styles/theme";

import { Text } from "./text";

export type InputProps = Omit<TextInputProps, "style" | "className"> & {
  /** Visible label and accessible name. */
  label: string;
  /** Validation message; announced to assistive technology when it appears. */
  error?: string | undefined;
  ref?: Ref<TextInput>;
};

/**
 * Labelled text field for React Hook Form (use with <Controller>). Error state
 * is conveyed by text and border, never colour alone.
 */
export function Input({ label, error, ref, ...props }: InputProps) {
  const { colors } = useTheme();
  const labelId = useId();

  return (
    <View className="gap-1">
      <Text variant="label" nativeID={labelId}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelId}
        accessibilityState={{ disabled: props.editable === false }}
        // Native prop: cannot be expressed as a className.
        placeholderTextColor={colors.mutedForeground}
        maxFontSizeMultiplier={2}
        {...props}
        className={`min-h-touch rounded-md bg-background px-3 py-2.5 text-body text-foreground ${error ? "border-2 border-danger" : "border border-input"}`}
      />
      {error ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
