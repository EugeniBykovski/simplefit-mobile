import { vars } from "nativewind";

/**
 * SimpleFit design tokens: "Graphite × Olive". The contract is
 * docs/design-tokens.json (shared with simplefit-platform, reconciled with the
 * canonical Claude Design artifact in SF-17); tokens.test.ts asserts this file
 * matches it. See docs/design-system.md.
 *
 * Two layers, identical names and values to simplefit-platform:
 *   1. `rawPalette`: brand primitives. Referenced ONLY in this file.
 *   2. `palettes`: semantic tokens per theme. Components use them through
 *      NativeWind classes (bg-surface, text-muted-foreground); ThemeRoot sets
 *      the CSS variables those classes read. Native props that cannot take a
 *      className (icon colours, Switch tracks, placeholder text, navigation
 *      theme) read `useTheme().colors`.
 *
 * Dark is the default theme and the canonical, pixel-faithful reference; the
 * light theme is derived for legibility and contrast, not designed.
 */
export const rawPalette = {
  graphite950: "#111312",
  graphite975: "#0d0e0d",
  graphite925: "#151816",
  graphite900: "#181b19",
  graphite850: "#1f2320",
  graphite800: "#282d29",
  graphite700: "#2e332f",
  graphite600: "#3a403b",
  bone: "#edefe7",
  bone50: "#f8f9f4",
  bone200: "#e3e6db",
  bone300: "#d2d6c8",
  bone400: "#c2c7b7",
  stone500: "#a7ad9f",
  stone550: "#848b80",
  stone600: "#575d52",
  stone650: "#62685d",
  stone700: "#3f453d",
  olive200: "#e4eab8",
  olive300: "#c9d17e",
  olive350: "#b9c08e",
  olive400: "#aeb95a",
  olive500: "#8d9840",
  olive600: "#4e5626",
  olive700: "#3b411c",
  olive800: "#333a1c",
  olive900: "#262b15",
  amber: "#e3a24f",
  amber200: "#f2d3a6",
  amber700: "#7a5216",
  amberTintDark: "#3a2e1a",
  amberBorderDark: "#5a4421",
  amberTintLight: "#f6e7cf",
  amberBorderLight: "#e8c690",
  coral: "#e07a5f",
  coral200: "#f0a28e",
  coral600: "#b4492e",
  coral700: "#8f3a24",
  coralTintDark: "#2a1a16",
  coralBorderDark: "#4a2a22",
  coralTintLight: "#f6e0d8",
  coralBorderLight: "#ebb8a8",
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
  surfaceSunken: string;
  muted: string;
  mutedForeground: string;
  faintForeground: string;
  border: string;
  borderSubtle: string;
  borderStrong: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  primaryMuted: string;
  secondary: string;
  secondaryForeground: string;
  highlight: string;
  highlightForeground: string;
  accent: string;
  accentForeground: string;
  accentMutedForeground: string;
  accentStrong: string;
  accentBorder: string;
  destructive: string;
  destructiveForeground: string;
  destructiveSubtle: string;
  destructiveSubtleForeground: string;
  destructiveBorder: string;
  success: string;
  successForeground: string;
  successSubtle: string;
  successSubtleForeground: string;
  successBorder: string;
  warning: string;
  warningForeground: string;
  warningSubtle: string;
  warningSubtleForeground: string;
  warningBorder: string;
  info: string;
  infoForeground: string;
  infoSubtle: string;
  infoSubtleForeground: string;
  infoBorder: string;
  overlay: string;
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
    surfaceSunken: p.graphite975,
    muted: p.graphite850,
    mutedForeground: p.stone500,
    faintForeground: p.stone550,
    border: p.graphite800,
    borderSubtle: p.graphite850,
    borderStrong: p.graphite600,
    input: p.graphite700,
    ring: p.olive300,
    primary: p.olive400,
    primaryForeground: p.graphite950,
    primaryMuted: p.olive500,
    secondary: p.bone,
    secondaryForeground: p.graphite950,
    highlight: p.olive300,
    highlightForeground: p.graphite950,
    accent: p.olive900,
    accentForeground: p.olive200,
    accentMutedForeground: p.olive350,
    accentStrong: p.olive800,
    accentBorder: p.olive600,
    destructive: p.coral,
    destructiveForeground: p.graphite950,
    destructiveSubtle: p.coralTintDark,
    destructiveSubtleForeground: p.coral200,
    destructiveBorder: p.coralBorderDark,
    success: p.olive400,
    successForeground: p.graphite950,
    successSubtle: p.olive900,
    successSubtleForeground: p.olive300,
    successBorder: p.olive600,
    warning: p.amber,
    warningForeground: p.graphite950,
    warningSubtle: p.amberTintDark,
    warningSubtleForeground: p.amber200,
    warningBorder: p.amberBorderDark,
    info: p.bone300,
    infoForeground: p.graphite950,
    infoSubtle: p.graphite850,
    infoSubtleForeground: p.bone200,
    infoBorder: p.graphite700,
    // Scrim colour; components apply the opacity (bg-overlay/70).
    overlay: "#050605",
  },
  light: {
    background: p.bone,
    foreground: p.graphite950,
    surface: p.bone50,
    surfaceForeground: p.graphite950,
    surfaceSubtle: p.bone200,
    surfaceElevated: p.white,
    surfaceSunken: p.bone200,
    muted: p.bone200,
    mutedForeground: p.stone600,
    faintForeground: p.stone650,
    border: p.bone300,
    borderSubtle: p.bone200,
    borderStrong: p.bone400,
    input: p.bone400,
    ring: p.olive600,
    primary: p.olive600,
    primaryForeground: p.bone,
    primaryMuted: p.olive500,
    secondary: p.graphite900,
    secondaryForeground: p.bone,
    highlight: p.olive600,
    highlightForeground: p.bone,
    accent: p.olive200,
    accentForeground: p.olive700,
    accentMutedForeground: p.olive600,
    accentStrong: p.olive300,
    accentBorder: p.olive300,
    destructive: p.coral600,
    destructiveForeground: p.white,
    destructiveSubtle: p.coralTintLight,
    destructiveSubtleForeground: p.coral700,
    destructiveBorder: p.coralBorderLight,
    success: p.olive600,
    successForeground: p.bone,
    successSubtle: p.olive200,
    successSubtleForeground: p.olive700,
    successBorder: p.olive300,
    warning: p.amber,
    warningForeground: p.graphite950,
    warningSubtle: p.amberTintLight,
    warningSubtleForeground: p.amber700,
    warningBorder: p.amberBorderLight,
    info: p.stone700,
    infoForeground: p.bone,
    infoSubtle: p.bone200,
    infoSubtleForeground: p.graphite700,
    infoBorder: p.bone300,
    overlay: p.graphite950,
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
