import { useId, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/shared/styles/theme";

import { Text } from "./text";

export type InputProps = Omit<TextInputProps, "style" | "className"> & {
  /** Visible label and accessible name. */
  label: string;
  /** Helper text under the field. */
  description?: string | undefined;
  /** Validation message; announced to assistive technology when it appears. */
  error?: string | undefined;
  ref?: Ref<TextInput>;
};

/**
 * Labelled text field for React Hook Form (use with <Controller>). Error state
 * is conveyed by text and border, never colour alone. `multiline` turns it
 * into a text area (see Textarea).
 */
export function Input({ label, description, error, ref, multiline, ...props }: InputProps) {
  const { colors } = useTheme();
  const labelId = useId();

  return (
    <View className="gap-1.5">
      <Text variant="bodySmall" weight="semibold" nativeID={labelId}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={description}
        accessibilityState={{ disabled: props.editable === false }}
        // Native prop: cannot be expressed as a className.
        placeholderTextColor={colors.mutedForeground}
        maxFontSizeMultiplier={2}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
        className={`rounded-md bg-surface-subtle px-3.5 font-sans text-body text-foreground ${multiline ? "min-h-28 py-3" : "min-h-touch py-2.5"} ${error ? "border-2 border-destructive" : "border border-input"} ${props.editable === false ? "opacity-50" : ""}`}
      />
      {description && !error ? (
        <Text variant="caption" color="mutedForeground">
          {description}
        </Text>
      ) : null}
      {error ? (
        <Text
          variant="caption"
          color="destructive"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
