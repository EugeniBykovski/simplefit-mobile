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
  "faint-foreground",
  "border",
  "border-strong",
  "input",
  "ring",
  "primary",
  "primary-foreground",
  "primary-muted",
  "secondary",
  "secondary-foreground",
  "highlight",
  "highlight-foreground",
  "accent",
  "accent-foreground",
  "accent-muted-foreground",
  "accent-strong",
  "accent-border",
  "destructive",
  "destructive-foreground",
  "destructive-subtle",
  "destructive-subtle-foreground",
  "destructive-border",
  "success",
  "success-foreground",
  "success-subtle",
  "success-subtle-foreground",
  "success-border",
  "warning",
  "warning-foreground",
  "warning-subtle",
  "warning-subtle-foreground",
  "warning-border",
  "info",
  "info-foreground",
  "info-subtle",
  "info-subtle-foreground",
  "info-border",
  "overlay",
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
    // Only the SimpleFit type scale exists (docs/design-tokens.json roles);
    // families and weights are chosen by <Text variant>.
    fontSize: {
      display: ["44px", "48px"],
      h1: ["26px", "30px"],
      h2: ["22px", "26px"],
      h3: ["19px", "24px"],
      title: ["15px", "20px"],
      "metric-xl": ["30px", "34px"],
      "metric-lg": ["26px", "30px"],
      metric: ["22px", "26px"],
      "metric-sm": ["18px", "22px"],
      "body-lg": ["15px", "22px"],
      body: ["14px", "21px"],
      "body-sm": ["13px", "20px"],
      caption: ["12px", "18px"],
      micro: ["11px", "16px"],
      badge: ["10px", "14px"],
      "label-lg": ["11px", "16px"],
      label: ["10px", "14px"],
    },
    // Radius scale (docs/design-tokens.json): xs marks, sm badges, md compact
    // controls, lg fields, xl primary CTAs, 2xl compact cards, 3xl cards,
    // 4xl sheets and dialogs; full for pills and circles.
    borderRadius: {
      none: "0px",
      xs: "6px",
      sm: "9px",
      md: "12px",
      lg: "16px",
      xl: "18px",
      "2xl": "20px",
      "3xl": "22px",
      "4xl": "28px",
      full: "9999px",
    },
    extend: {
      // React Native needs one family per weight (no synthesized bold).
      fontFamily: {
        display: ["Unbounded_600SemiBold"],
        "display-bold": ["Unbounded_700Bold"],
        sans: ["Manrope_400Regular"],
        "sans-semibold": ["Manrope_600SemiBold"],
        "sans-bold": ["Manrope_700Bold"],
        "sans-extrabold": ["Manrope_800ExtraBold"],
        mono: ["JetBrainsMono_400Regular"],
        system: platformSelect({ ios: "System", android: "sans-serif", default: "System" }),
      },
      // Letter spacing per role, in px (React Native has no em): size × tracking.
      letterSpacing: {
        display: "-0.88px",
        h1: "-0.52px",
        h2: "-0.44px",
        h3: "-0.19px",
        "metric-xl": "-0.9px",
        "metric-lg": "-0.78px",
        metric: "-0.66px",
        "metric-sm": "-0.54px",
        "label-lg": "1.76px",
        label: "1.4px",
      },
      // Spacing steps the default scale lacks (docs/design-tokens.json spacing).
      spacing: { 4.5: "18px", 5.5: "22px" },
      // Control heights (docs/design-tokens.json controls) and touch targets:
      // 44 pt minimum (Apple HIG), 60 pt gym mode.
      minHeight: {
        touch: "44px",
        "touch-gym": "60px",
        "button-sm": "36px",
        "button-md": "50px",
        "button-lg": "56px",
        field: "54px",
      },
      minWidth: { touch: "44px", "touch-gym": "60px" },
    },
  },
  plugins: [],
};

module.exports.semanticColors = semanticColors;
