// @ts-check
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier/flat");

/**
 * Raw colours bypass the theme (and break light/dark switching). Every string
 * in a component file is checked, because variant maps hold class names
 * outside className attributes. Hex values live only in src/shared/styles.
 */
const rawColor =
  "#[0-9a-fA-F]{3,8}\\b|-\\[(#|rgb|hsl)|\\b(bg|text|border|ring|fill|stroke|outline|divide|from|via|to|shadow|caret|accent|decoration|placeholder|tint)-(black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-[0-9]{2,3})?\\b";
const rawColorMessage =
  "Use semantic colour tokens (bg-surface, text-muted-foreground, ...), not hex values, arbitrary colours or palette names.";

/**
 * Design-scale guards (docs/design-tokens.json, SF-16/SF-17).
 *
 * typeScale (every component file): text is sized only by <Text variant>
 * roles; Tailwind's default font sizes, leading and tracking presets and
 * non-canonical weights are not part of the design system, and bare `rounded`
 * has no value in the SimpleFit radius scale.
 *
 * offScale and spacingSteps (product code; primitives in src/shared/ui own
 * their internal geometry): no arbitrary spacing, radius or type values, and
 * spacing uses only the canonical steps. Layout dimensions (w/h/size/inset)
 * may stay arbitrary.
 */
const typeScale =
  "\\b(text-(xs|sm|base|lg|xl|[2-9]xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-(none|tight|snug|normal|relaxed|loose)|tracking-(tighter|tight|normal|wide|wider|widest))(?![\\w-])|(^|[\\s:])rounded(?![\\w-])";
const typeScaleMessage =
  "Use <Text variant> roles and the SimpleFit radius scale (docs/design-tokens.json): Tailwind's default text sizes, weights, leading, tracking and bare `rounded` are not part of the design system.";
const offScale =
  "\\b(-?[pm][xytrblse]?|gap(-[xy])?|space-[xy]|rounded(-[a-z]{1,2})?|text|leading|tracking|font)-\\[";
const offScaleMessage =
  "Off-scale value: use the SF-13 spacing, radius and type scales (docs/design-handoff.md §8.1), not arbitrary values.";
const spacingSteps =
  "(^|[\\s:])-?([pm][xytrblse]?|gap(-[xy])?|space-[xy])-(?=\\d)(?!(0|0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|4\\.5|5|5\\.5|6|8|10|12|14|16|20)(?![\\w.-]))";
const spacingStepsMessage =
  "Spacing step outside the SimpleFit scale (docs/design-tokens.json spacing.steps: 0.5–6 in half steps, then 8, 10, 12, 14, 16, 20).";
const literalGuard = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
];

// Utility-first styling selectors, shared by the .ts and .tsx blocks (flat
// config replaces rule options per block, so the .tsx block repeats them).
const stylingSelectors = [
  {
    selector: "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
    message:
      "Use NativeWind className for static styling. StyleSheet.create is reserved for justified native/animation exceptions (disable inline with a reason).",
  },
  {
    selector:
      "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression:not(:has(SpreadElement)):not(:has(Property[value.type!='Literal']))",
    message:
      "Static inline style: use className. Keep `style` for genuinely dynamic values (disable inline with a reason for third-party components without className).",
  },
  {
    selector:
      "ImportDeclaration[source.value=/^(styled-components(\\/native)?|@emotion\\/(native|react|styled))$/]",
    message: "CSS-in-JS is not used: style with NativeWind className.",
  },
];

/** Higher layers each FSD-lite layer must not import from. */
// The FSD "app" layer is src/app (Expo Router routes) + src/providers.
const forbiddenLayers = {
  "src/shared/**": ["app", "providers", "widgets", "features", "entities"],
  "src/entities/**": ["app", "providers", "widgets", "features"],
  "src/features/**": ["app", "providers", "widgets"],
  "src/widgets/**": ["app", "providers"],
};

/** Device persistence is only reachable through src/shared/storage. */
const storagePaths = [
  {
    name: "expo-secure-store",
    message: "Use @/shared/storage (secure-storage) so sensitive data stays behind one boundary.",
  },
  {
    name: "@react-native-async-storage/async-storage",
    message: "Use @/shared/storage (preferences); never store secrets in AsyncStorage.",
  },
];

// Flat config replaces (not merges) rule options per block, so every block
// repeats the shared storage restriction alongside its layer patterns.
const restrict = (patterns, paths = storagePaths) => ["error", { paths, patterns }];

module.exports = defineConfig([
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  { rules: { "no-console": ["error", { allow: ["warn", "error"] }] } },
  { files: ["src/**"], rules: { "no-restricted-imports": restrict([]) } },
  ...Object.entries(forbiddenLayers).map(([files, layers]) => ({
    files: [files],
    rules: {
      "no-restricted-imports": restrict([
        {
          group: layers.map((layer) => `@/${layer}/*`),
          message: `This layer must not import from: ${layers.join(", ")}. Dependencies point downwards (app > widgets > features > entities > shared).`,
        },
      ]),
    },
  })),
  {
    // The storage boundary itself wraps the native modules.
    files: ["src/shared/storage/**"],
    rules: {
      "no-restricted-imports": restrict(
        [
          {
            group: ["@/app/*", "@/providers/*", "@/widgets/*", "@/features/*", "@/entities/*"],
            message: "shared/ must not import from higher layers.",
          },
        ],
        [],
      ),
    },
  },
  {
    // Network access goes through the generated client and its transport.
    files: ["src/**"],
    ignores: ["src/shared/api/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Call the API through @/shared/api (generated client)." },
      ],
    },
  },
  {
    // Environment variables are read and validated in one place.
    files: ["src/**"],
    ignores: ["src/shared/config/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read configuration from @/shared/config/env.",
        },
      ],
    },
  },
  {
    // Utility-first styling: static styles belong in `className` (NativeWind).
    // `style` stays available for runtime values (insets, animations, gesture
    // transforms, theme variables) and components without className support;
    // a legitimate static exception needs an inline disable with a reason.
    files: ["src/**/*.tsx", "src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...stylingSelectors],
    },
  },
  {
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...stylingSelectors,
        { selector: `Literal[value=/${rawColor}/]`, message: rawColorMessage },
        { selector: `TemplateElement[value.raw=/${rawColor}/]`, message: rawColorMessage },
        ...literalGuard(typeScale, typeScaleMessage),
      ],
    },
  },
  {
    // Product code (everything but the primitives) also keeps to the design
    // scales. Flat config replaces rule options, so the selectors repeat.
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx", "src/shared/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...stylingSelectors,
        { selector: `Literal[value=/${rawColor}/]`, message: rawColorMessage },
        { selector: `TemplateElement[value.raw=/${rawColor}/]`, message: rawColorMessage },
        ...literalGuard(typeScale, typeScaleMessage),
        ...literalGuard(offScale, offScaleMessage),
        ...literalGuard(spacingSteps, spacingStepsMessage),
      ],
    },
  },
  {
    // jest.mock() factories must use require() (they are hoisted above imports).
    files: ["jest.setup.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Plain-JS Jest tests (TS tests get Jest globals from @types/jest).
    files: ["**/*.test.js"],
    languageOptions: {
      globals: { describe: "readonly", it: "readonly", expect: "readonly", jest: "readonly" },
    },
  },
  {
    files: ["scripts/**", "*.config.js", "*.config.ts"],
    rules: { "no-console": "off" },
  },
  // Formatting is owned by Prettier; last, to disable conflicting rules.
  prettier,
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "coverage/**",
    "ios/**",
    "android/**",
    "expo-env.d.ts",
    // Generated by Orval from openapi/simplefit.api.json. DO NOT EDIT MANUALLY.
    "src/shared/api/generated/**",
    "src/shared/api/.generated-check/**",
  ]),
]);
