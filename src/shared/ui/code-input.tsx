import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text, type TextColor } from "./text";

export const CODE_LENGTH = 6;

/**
 * Visual state of the code (Claude Design component "AuthCodeInput").
 * `typing` shows the caret cell while focused; `filled` is a complete code at
 * rest. `expired`, `submitting`, `success` and `locked` make the field
 * read-only.
 */
export type CodeInputState =
  "typing" | "filled" | "error" | "expired" | "submitting" | "success" | "locked";

const READ_ONLY: ReadonlySet<CodeInputState> = new Set([
  "expired",
  "submitting",
  "success",
  "locked",
]);

const CELL: Record<CodeInputState, { cell: string; text: TextColor }> = {
  typing: { cell: "border border-border bg-surface", text: "foreground" },
  filled: { cell: "border border-border bg-surface", text: "foreground" },
  error: {
    cell: "border-[1.5px] border-destructive bg-surface",
    text: "destructiveSubtleForeground",
  },
  expired: { cell: "border border-border bg-surface-subtle", text: "faintForeground" },
  locked: { cell: "border border-border bg-surface-subtle", text: "faintForeground" },
  submitting: { cell: "border border-border bg-surface", text: "faintForeground" },
  success: { cell: "border-[1.5px] border-highlight bg-accent", text: "accentForeground" },
};

export type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called once the sixth digit is entered or pasted (or filled from the email by iOS). */
  onComplete?: (code: string) => void;
  state?: CodeInputState;
  /** Accessible name, e.g. "6-digit code". */
  label: string;
  autoFocus?: boolean;
};

/**
 * The shared 6-digit code field of email verification (O03) and email
 * sign-in (O01c), mobile size: six cells sharing the 350 pt column, 62 pt
 * tall, radius `lg`, 8 pt apart, `codeDigit` type (typography.authRoles).
 *
 * One real TextInput (`oneTimeCode`, so iOS can offer the code from Mail and
 * Android from its autofill) covers the decorative cells: typing, deleting,
 * pasting and screen readers work as in any text field. Purpose, copy,
 * resend and outcome belong to the screens.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  state = "typing",
  label,
  autoFocus = false,
}: CodeInputProps) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const readOnly = READ_ONLY.has(state);
  const digits = value.slice(0, CODE_LENGTH);
  const tone = CELL[state];

  function handleChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(next);
    if (next.length === CODE_LENGTH && next !== digits) onComplete?.(next);
  }

  return (
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      className="relative w-full"
    >
      <View
        className="flex-row gap-2"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const caret = state === "typing" && focused && index === digits.length;
          return (
            <View
              key={index}
              testID="code-input-cell"
              className={`h-[62px] flex-1 items-center justify-center rounded-lg ${caret ? "border-[1.5px] border-primary bg-surface" : tone.cell}`}
            >
              <Text variant="codeDigit" color={caret ? "faintForeground" : tone.text}>
                {caret ? "|" : (digits[index] ?? "")}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        accessibilityState={{ disabled: readOnly }}
        accessibilityValue={{ text: digits }}
        value={digits}
        onChangeText={handleChange}
        editable={!readOnly}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        caretHidden
        contextMenuHidden={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID="code-input"
        // Near-zero, not zero: UIKit ignores touches on views below 1 % alpha.
        className="absolute inset-0 text-transparent opacity-[0.02]"
      />
    </Pressable>
  );
}
