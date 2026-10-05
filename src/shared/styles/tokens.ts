import { vars } from "nativewind";

/**
 * SimpleFit design tokens: "Graphite × Olive" (Visual System 2026,
 * docs/design/design system.pdf). See docs/design-system.md.
 *
 * Two layers, identical names and values to simplefit-platform:
 *   1. `rawPalette`: brand primitives. Referenced ONLY in this file.
 *   2. `palettes`: semantic tokens per theme. Components use them through
 *      NativeWind classes (bg-surface, text-muted-foreground); ThemeRoot sets
 *      the CSS variables those classes read. Native props that cannot take a
 *      className (icon colours, Switch tracks, placeholder text, navigation
 *      theme) read `useTheme().colors`.
 *
 * Dark is the default theme (the brand is dark-first).
 */
export const rawPalette = {
  graphite950: "#111312",
  graphite925: "#151816",
  graphite900: "#181b19",
  graphite850: "#1f2320",
  graphite800: "#272b28",
  graphite700: "#2e332f",
  bone: "#edefe7",
  bone50: "#f8f9f4",
  bone200: "#e3e6db",
  bone300: "#d2d6c8",
  bone400: "#c2c7b7",
  stone500: "#a1a69a",
  stone600: "#575d52",
  stone700: "#3f453d",
  olive200: "#e4eab8",
  olive300: "#c9d17e",
  olive400: "#aeb95a",
  olive600: "#4e5626",
  olive700: "#3b411c",
  olive900: "#262815",
  amber: "#e2a250",
  amber700: "#7a5216",
  amberTintDark: "#33281a",
  amberTintLight: "#f6e7cf",
  coral: "#df7a5e",
  coral600: "#b4492e",
  coral700: "#8f3a24",
  coralTintDark: "#33201b",
  coralTintLight: "#f6e0d8",
  white: "#ffffff",
} as const;

export type ColorScheme = "light" | "dark";

export type SemanticColors = {
  background: string;
  foreground: string;
  surface: string;
  surfaceForeground: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  overlay: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  destructiveSubtle: string;
  destructiveSubtleForeground: string;
  success: string;
  successForeground: string;
  successSubtle: string;
  successSubtleForeground: string;
  warning: string;
  warningForeground: string;
  warningSubtle: string;
  warningSubtleForeground: string;
  info: string;
  infoForeground: string;
  infoSubtle: string;
  infoSubtleForeground: string;
};

const p = rawPalette;

export const palettes: Record<ColorScheme, SemanticColors> = {
  dark: {
    background: p.graphite950,
    foreground: p.bone,
    surface: p.graphite900,
    surfaceForeground: p.bone,
    surfaceSubtle: p.graphite925,
    surfaceElevated: p.graphite850,
    muted: p.graphite850,
    mutedForeground: p.stone500,
    border: p.graphite800,
    input: p.graphite700,
    ring: p.olive300,
    // Scrim colour; components apply the opacity (bg-overlay/70).
    overlay: "#050605",
    primary: p.olive400,
    primaryForeground: p.graphite950,
    secondary: p.bone,
    secondaryForeground: p.graphite950,
    accent: p.olive900,
    accentForeground: p.olive200,
    destructive: p.coral,
    destructiveForeground: p.graphite950,
    destructiveSubtle: p.coralTintDark,
    destructiveSubtleForeground: p.coral,
    success: p.olive400,
    successForeground: p.graphite950,
    successSubtle: p.olive900,
    successSubtleForeground: p.olive300,
    warning: p.amber,
    warningForeground: p.graphite950,
    warningSubtle: p.amberTintDark,
    warningSubtleForeground: p.amber,
    info: p.bone300,
    infoForeground: p.graphite950,
    infoSubtle: p.graphite850,
    infoSubtleForeground: p.bone200,
  },
  light: {
    background: p.bone,
    foreground: p.graphite950,
    surface: p.bone50,
    surfaceForeground: p.graphite950,
    surfaceSubtle: p.bone200,
    surfaceElevated: p.white,
    muted: p.bone200,
    mutedForeground: p.stone600,
    border: p.bone300,
    input: p.bone400,
    ring: p.olive600,
    overlay: p.graphite950,
    primary: p.olive600,
    primaryForeground: p.bone,
    secondary: p.graphite900,
    secondaryForeground: p.bone,
    accent: p.olive200,
    accentForeground: p.olive700,
    destructive: p.coral600,
    destructiveForeground: p.white,
    destructiveSubtle: p.coralTintLight,
    destructiveSubtleForeground: p.coral700,
    success: p.olive600,
    successForeground: p.bone,
    successSubtle: p.olive200,
    successSubtleForeground: p.olive700,
    warning: p.amber,
    warningForeground: p.graphite950,
    warningSubtle: p.amberTintLight,
    warningSubtleForeground: p.amber700,
    info: p.stone700,
    infoForeground: p.bone,
    infoSubtle: p.bone200,
    infoSubtleForeground: p.graphite700,
  },
};

/** `surfaceForeground` -> `surface-foreground` (Tailwind / CSS variable name). */
export function tokenCssName(token: keyof SemanticColors): string {
  return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** "#0a0a0a" -> "10 10 10" (space-separated channels for rgb(var() / alpha)). */
function channels(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** NativeWind CSS variables for a scheme, applied once at the app root. */
export function themeVariables(scheme: ColorScheme) {
  return vars(
    Object.fromEntries(
      (Object.keys(palettes[scheme]) as (keyof SemanticColors)[]).map((token) => [
        `--color-${tokenCssName(token)}`,
        channels(palettes[scheme][token]),
      ]),
    ),
  );
}
