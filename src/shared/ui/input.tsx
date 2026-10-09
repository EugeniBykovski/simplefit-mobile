import { useId, useState, type Ref } from "react";
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
  /**
   * A non-editable field that keeps the designed look instead of the dimmed
   * disabled one (SF-24: designed controls whose behaviour belongs to a later
   * domain). Assistive technology still reports it as disabled.
   */
  presentational?: boolean;
  /** A unit shown at the end of a single-line field (e.g. "kg"); read with the hint. */
  unit?: string | undefined;
};

/**
 * Labelled text field for React Hook Form (use with <Controller>). Canonical
 * mobile field (docs/design-tokens.json controls.field): 54 pt, radius lg,
 * Manrope 15/600 on the `surface` well with a hairline border; the focused
 * field shows the olive border. Label: caption 700, muted. Error state is
 * conveyed by text and border, never colour alone. `multiline` turns it into a
 * text area (see Textarea).
 */
export function Input({
  label,
  description,
  error,
  ref,
  multiline,
  presentational = false,
  unit,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const border = error
    ? "border-2 border-destructive"
    : focused
      ? "border-[1.5px] border-primary"
      : "border border-border";

  return (
    <View className="gap-1.5">
      <Text variant="caption" weight="bold" color="mutedForeground" nativeID={labelId}>
        {label}
      </Text>
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          accessibilityHint={[unit, description].filter(Boolean).join(". ") || undefined}
          accessibilityState={{ disabled: props.editable === false }}
          // Native prop: cannot be expressed as a className.
          placeholderTextColor={colors.faintForeground}
          maxFontSizeMultiplier={2}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
          className={`rounded-lg bg-surface px-4 font-sans-semibold text-body-lg text-foreground ${multiline ? "min-h-28 py-3.5" : "min-h-field py-3"} ${unit ? "pr-12" : ""} ${border} ${props.editable === false && !presentational ? "opacity-50" : ""}`}
        />
        {unit && !multiline ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute inset-y-0 right-4 justify-center"
          >
            <Text color="faintForeground">{unit}</Text>
          </View>
        ) : null}
      </View>
      {description && !error ? (
        <Text variant="caption" color="faintForeground">
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
