const { platformSelect } = require("nativewind/theme");

/**
 * Semantic colour tokens (same names as simplefit-platform). Values are CSS
 * variables set at the app root from src/shared/styles/tokens.ts via
 * NativeWind vars(), so light/dark switch in one place. Tailwind's default
 * palette is replaced: only semantic colours exist.
 */
const semanticColors = [
  "background",
  "foreground",
  "surface",
  "surface-foreground",
  "surface-subtle",
  "surface-elevated",
  "muted",
  "muted-foreground",
  "border",
  "input",
  "ring",
  "overlay",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "destructive-subtle",
  "destructive-subtle-foreground",
  "success",
  "success-foreground",
  "success-subtle",
  "success-subtle-foreground",
  "warning",
  "warning-foreground",
  "warning-subtle",
  "warning-subtle-foreground",
  "info",
  "info-foreground",
  "info-subtle",
  "info-subtle-foreground",
];

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    colors: {
      transparent: "transparent",
      ...Object.fromEntries(
        semanticColors.map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
      ),
    },
    extend: {
      // Inputs/buttons md, cards xl (22 px per the design), sheets 2xl.
      borderRadius: { xs: "6px", sm: "10px", md: "14px", lg: "18px", xl: "22px", "2xl": "28px" },
      // React Native needs one family per weight (no synthesized bold).
      fontFamily: {
        display: ["Unbounded_700Bold"],
        "display-semibold": ["Unbounded_600SemiBold"],
        sans: ["Manrope_400Regular"],
        "sans-medium": ["Manrope_500Medium"],
        "sans-semibold": ["Manrope_600SemiBold"],
        "sans-bold": ["Manrope_700Bold"],
        mono: ["JetBrainsMono_500Medium"],
        system: platformSelect({ ios: "System", android: "sans-serif", default: "System" }),
      },
      // Type scale (font size / line height); families are chosen by <Text variant>.
      fontSize: {
        display: ["44px", "48px"],
        h1: ["32px", "36px"],
        h2: ["24px", "29px"],
        h3: ["20px", "26px"],
        title: ["17px", "24px"],
        body: ["16px", "23px"],
        "body-sm": ["14px", "20px"],
        label: ["11px", "14px"],
        caption: ["12px", "16px"],
      },
      letterSpacing: { label: "1.3px", display: "-0.8px" },
      // Touch targets: 44 pt default (Apple HIG); 60 pt "gym mode" per the design.
      minHeight: { touch: "44px", "touch-gym": "60px" },
      minWidth: { touch: "44px", "touch-gym": "60px" },
    },
  },
  plugins: [],
};

module.exports.semanticColors = semanticColors;
