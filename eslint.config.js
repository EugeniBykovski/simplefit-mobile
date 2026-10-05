// @ts-check
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier/flat");

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
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
          message:
            "Use NativeWind className for static styling. StyleSheet.create is reserved for justified native/animation exceptions (disable inline with a reason).",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression:not(:has(SpreadElement)):not(:has(Property[value.type!='Literal']))",
          message:
            "Static inline style: use className. Keep `style` for genuinely dynamic values (disable inline with a reason for third-party components without className).",
        },
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
