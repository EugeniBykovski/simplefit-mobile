import { Text as RNText, type TextProps as RNTextProps } from "react-native";

// Literal class names so Tailwind can see them. Families encode the weight
// (React Native does not synthesize weights for custom fonts).
const variants = {
  display: "font-display text-display tracking-display",
  h1: "font-display text-h1",
  h2: "font-display-semibold text-h2",
  h3: "font-sans-bold text-h3",
  title: "font-sans-bold text-title",
  body: "font-sans text-body",
  bodySmall: "font-sans text-body-sm",
  label: "font-mono text-label uppercase tracking-label",
  caption: "font-sans-medium text-caption",
} as const;

const weights = {
  medium: "font-sans-medium",
  semibold: "font-sans-semibold",
  bold: "font-sans-bold",
} as const;

const colors = {
  foreground: "text-foreground",
  mutedForeground: "text-muted-foreground",
  surfaceForeground: "text-surface-foreground",
  primary: "text-primary",
  primaryForeground: "text-primary-foreground",
  secondaryForeground: "text-secondary-foreground",
  accentForeground: "text-accent-foreground",
  destructive: "text-destructive",
  destructiveForeground: "text-destructive-foreground",
  destructiveSubtleForeground: "text-destructive-subtle-foreground",
  successForeground: "text-success-foreground",
  successSubtleForeground: "text-success-subtle-foreground",
  warningForeground: "text-warning-foreground",
  warningSubtleForeground: "text-warning-subtle-foreground",
  infoForeground: "text-info-foreground",
  infoSubtleForeground: "text-info-subtle-foreground",
} as const;

export type TextVariant = keyof typeof variants;
export type TextColor = keyof typeof colors;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  /** Heavier Manrope weight for body/caption text (e.g. button labels). */
  weight?: keyof typeof weights;
};

const headers: readonly TextVariant[] = ["display", "h1", "h2", "h3"];

/**
 * Themed text on the SimpleFit type scale. Display and heading variants are
 * exposed to assistive technology as headers. Font scaling is respected (up
 * to 2× to keep layouts usable).
 */
export function Text({
  variant = "body",
  color = "foreground",
  weight,
  className,
  ...props
}: TextProps) {
  return (
    <RNText
      accessibilityRole={headers.includes(variant) ? "header" : props.accessibilityRole}
      maxFontSizeMultiplier={2}
      {...props}
      className={`${variants[variant]} ${weight ? weights[weight] : ""} ${colors[color]} ${className ?? ""}`}
    />
  );
}
