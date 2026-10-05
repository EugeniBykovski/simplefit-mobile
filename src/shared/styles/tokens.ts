import { vars } from "nativewind";

/**
 * SimpleFit semantic colour tokens for React Native: FOUNDATION PLACEHOLDERS.
 *
 * This file is the single source of colour VALUES. NAMES match the web
 * contract (background, foreground, surface, muted, primary, secondary,
 * accent, success, warning, danger, border + input, ring; each content colour
 * with a *Foreground pair). SF-13 replaces the values.
 *
 * How they are consumed:
 * - className (default): Tailwind classes such as `bg-surface` or
 *   `text-muted-foreground` read CSS variables that ThemeRoot sets from these
 *   palettes (tailwind.config.js maps every name).
 * - Native props that cannot take a className (icon `color`,
 *   ActivityIndicator `color`, `placeholderTextColor`, navigation theme) read
 *   the palette through useTheme().
 */
export type ColorScheme = "light" | "dark";

export type SemanticColors = {
  background: string;
  foreground: string;
  surface: string;
  surfaceForeground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  danger: string;
  dangerForeground: string;
  border: string;
  input: string;
  ring: string;
};

export const palettes: Record<ColorScheme, SemanticColors> = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    surface: "#ffffff",
    surfaceForeground: "#0a0a0a",
    muted: "#f5f5f5",
    mutedForeground: "#616161",
    primary: "#171717",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    secondaryForeground: "#171717",
    accent: "#f5f5f5",
    accentForeground: "#171717",
    success: "#15803d",
    successForeground: "#ffffff",
    warning: "#f59e0b",
    warningForeground: "#1a1a1a",
    danger: "#dc2626",
    dangerForeground: "#ffffff",
    border: "#e5e5e5",
    input: "#d4d4d4",
    ring: "#a3a3a3",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    surface: "#171717",
    surfaceForeground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    primary: "#e5e5e5",
    primaryForeground: "#171717",
    secondary: "#262626",
    secondaryForeground: "#fafafa",
    accent: "#262626",
    accentForeground: "#fafafa",
    success: "#4ade80",
    successForeground: "#0a0a0a",
    warning: "#fbbf24",
    warningForeground: "#0a0a0a",
    danger: "#f87171",
    dangerForeground: "#0a0a0a",
    border: "#272727",
    input: "#363636",
    ring: "#737373",
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
