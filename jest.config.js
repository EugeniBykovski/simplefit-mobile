// Public env for tests (inlined by babel-preset-expo like in the app).
process.env.EXPO_PUBLIC_API_URL = "http://api.test";
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
  "111111111111-webclienttest.apps.googleusercontent.com";
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID =
  "111111111111-iosclienttest.apps.googleusercontent.com";

/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}", "<rootDir>/scripts/**/*.test.js"],
  // pnpm stores packages under node_modules/.pnpm; transform React Native,
  // Expo and ESM-only packages wherever they live.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm|react-native|@react-native|@react-native-community|expo|@expo|expo-modules-core|react-navigation|@react-navigation|use-intl|intl-messageformat|@formatjs|icu-minify|@schummar))",
  ],
  // Lucide's "react-native" export is .mjs, which Jest does not transform;
  // tests use the package's CommonJS build of the same icons.
  moduleNameMapper: {
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
  clearMocks: true,
};
