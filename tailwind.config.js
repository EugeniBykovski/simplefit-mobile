const { platformSelect } = require("nativewind/theme");

/**
 * Semantic colour tokens. Values are CSS variables set at the app root from
 * the TypeScript palettes (src/shared/styles/tokens.ts) via NativeWind vars(),
 * so light/dark (and a future explicit theme choice) switch in one place.
 * Names match the web contract (simplefit-platform tokens.css).
 */
const semanticColors = [
  "background",
  "foreground",
  "surface",
  "surface-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "danger",
  "danger-foreground",
  "border",
  "input",
  "ring",
];

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: Object.fromEntries(
        semanticColors.map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`]),
      ),
      // Placeholder radius and type scale until SF-13 (SimpleFit Design System).
      borderRadius: { sm: "6px", md: "10px", lg: "14px" },
      fontSize: {
        title: ["30px", { lineHeight: "36px", fontWeight: "700" }],
        heading: ["20px", { lineHeight: "26px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "22px", fontWeight: "400" }],
        label: ["15px", { lineHeight: "20px", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "18px", fontWeight: "400" }],
      },
      fontFamily: {
        mono: platformSelect({ ios: "Menlo", android: "monospace", default: "monospace" }),
      },
      // Minimum touch target (Apple HIG 44 pt).
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
};

module.exports.semanticColors = semanticColors;
