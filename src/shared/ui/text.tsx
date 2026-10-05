import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const variants = {
  title: "text-title",
  heading: "text-heading",
  body: "text-body",
  label: "text-label",
  caption: "text-caption",
} as const;

// Literal class names so Tailwind can see them.
const colors = {
  foreground: "text-foreground",
  mutedForeground: "text-muted-foreground",
  surfaceForeground: "text-surface-foreground",
  primaryForeground: "text-primary-foreground",
  secondaryForeground: "text-secondary-foreground",
  accentForeground: "text-accent-foreground",
  successForeground: "text-success-foreground",
  warningForeground: "text-warning-foreground",
  dangerForeground: "text-danger-foreground",
  danger: "text-danger",
} as const;

export type TextColor = keyof typeof colors;

export type TextProps = RNTextProps & {
  variant?: keyof typeof variants;
  color?: TextColor;
};

/**
 * Themed text. `title` and `heading` are exposed to assistive technology as
 * headers. Respects the user's font scaling (Dynamic Type / font size).
 */
export function Text({ variant = "body", color = "foreground", className, ...props }: TextProps) {
  const isHeader = variant === "title" || variant === "heading";

  return (
    <RNText
      accessibilityRole={isHeader ? "header" : props.accessibilityRole}
      maxFontSizeMultiplier={2}
      {...props}
      className={`${variants[variant]} ${colors[color]} ${className ?? ""}`}
    />
  );
}
