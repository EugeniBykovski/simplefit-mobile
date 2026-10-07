import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/*
 * The SimpleFit type roles (docs/design-tokens.json typography.roles), the
 * same semantic scale as the web `type-*` utilities. Literal class names so
 * Tailwind can see them. React Native does not synthesize weights for custom
 * fonts, so each role names the font family of its weight.
 */
const variants = {
  display: { family: "font-display", classes: "text-display tracking-display" },
  h1: { family: "font-display", classes: "text-h1 tracking-h1" },
  h2: { family: "font-display", classes: "text-h2 tracking-h2" },
  h3: { family: "font-display", classes: "text-h3 tracking-h3" },
  title: { family: "font-display", classes: "text-title" },
  brand: { family: "font-display", classes: "text-brand tracking-brand" },
  metricXl: { family: "font-display-bold", classes: "text-metric-xl tracking-metric-xl" },
  metricLg: { family: "font-display-bold", classes: "text-metric-lg tracking-metric-lg" },
  metric: { family: "font-display-bold", classes: "text-metric tracking-metric" },
  metricSm: { family: "font-display-bold", classes: "text-metric-sm tracking-metric-sm" },
  bodyLg: { family: "font-sans", classes: "text-body-lg" },
  body: { family: "font-sans", classes: "text-body" },
  bodySm: { family: "font-sans", classes: "text-body-sm" },
  caption: { family: "font-sans", classes: "text-caption" },
  micro: { family: "font-sans", classes: "text-micro" },
  badge: { family: "font-sans-extrabold", classes: "text-badge uppercase" },
  labelLg: { family: "font-mono", classes: "text-label-lg uppercase tracking-label-lg" },
  label: { family: "font-mono", classes: "text-label uppercase tracking-label" },
  // System-state roles (SF-34): launch, 404 and error states only.
  hero: { family: "font-display", classes: "text-hero tracking-hero" },
  wordmark: { family: "font-display-bold", classes: "text-wordmark tracking-wordmark" },
  numeral: { family: "font-display-bold", classes: "text-numeral tracking-numeral" },
  numeralKo: { family: "font-display-bold", classes: "text-numeral-ko tracking-numeral-ko" },
  labelWide: {
    family: "font-mono-semibold",
    classes: "text-label-wide uppercase tracking-label-wide",
  },
  countWord: { family: "font-mono", classes: "text-count-word uppercase tracking-count-word" },
} as const;

/** Manrope weights of the contract above the role's regular 400. */
const weights = {
  semibold: "font-sans-semibold",
  bold: "font-sans-bold",
  extrabold: "font-sans-extrabold",
} as const;

const colors = {
  foreground: "text-foreground",
  mutedForeground: "text-muted-foreground",
  faintForeground: "text-faint-foreground",
  surfaceForeground: "text-surface-foreground",
  highlight: "text-highlight",
  highlightForeground: "text-highlight-foreground",
  primary: "text-primary",
  primaryForeground: "text-primary-foreground",
  secondaryForeground: "text-secondary-foreground",
  accentForeground: "text-accent-foreground",
  accentMutedForeground: "text-accent-muted-foreground",
  destructive: "text-destructive",
  destructiveForeground: "text-destructive-foreground",
  destructiveSubtleForeground: "text-destructive-subtle-foreground",
  successForeground: "text-success-foreground",
  successSubtleForeground: "text-success-subtle-foreground",
  warning: "text-warning",
  warningForeground: "text-warning-foreground",
  warningSubtleForeground: "text-warning-subtle-foreground",
  infoForeground: "text-info-foreground",
  infoSubtleForeground: "text-info-subtle-foreground",
} as const;

export type TextVariant = keyof typeof variants;
export type TextColor = keyof typeof colors;
export type TextWeight = keyof typeof weights;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
  /** Heavier Manrope weight for interface text (600 values, 700 labels, 800 emphasis). */
  weight?: TextWeight;
};

const headers: readonly TextVariant[] = ["display", "h1", "h2", "h3", "hero"];

/** Font family class for a role, raised to the requested Manrope weight. */
export function textFamily(variant: TextVariant, weight?: TextWeight): string {
  const { family } = variants[variant];
  if (weight === "semibold" && family === "font-mono") return "font-mono-semibold";
  return weight && family.startsWith("font-sans") ? weights[weight] : family;
}

/**
 * Themed text on the SimpleFit type scale. Display and heading roles are
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
      className={`${textFamily(variant, weight)} ${variants[variant].classes} ${colors[color]} ${className ?? ""}`}
    />
  );
}
