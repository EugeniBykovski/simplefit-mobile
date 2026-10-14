import * as ReactNative from "react-native";

/**
 * The React Native APIs the app imports. React Native exposes them through
 * lazy getters, so each one is required (and, on a cold Jest cache,
 * transformed) the first time a test renders it. That cost lands in the
 * timeout of whichever test renders first: about 1.8 s locally with a cold
 * cache, more than 5 s on a CI runner. `jest.setup.ts` loads them while the
 * test file is set up, outside every test's timeout. Only these are touched:
 * reading every export would also load (and warn about) deprecated ones.
 * `react-native-preload.test.ts` keeps the list in step with the imports.
 */
export const REACT_NATIVE_PRELOAD = [
  "AccessibilityInfo",
  "ActivityIndicator",
  "Animated",
  "AppState",
  "BackHandler",
  "Easing",
  "FlatList",
  "Image",
  "Keyboard",
  "KeyboardAvoidingView",
  "Linking",
  "Modal",
  "Platform",
  "Pressable",
  "ScrollView",
  "Switch",
  "Text",
  "TextInput",
  "TurboModuleRegistry",
  "View",
  "useColorScheme",
  "useWindowDimensions",
] as const;

export function preloadReactNative(): void {
  for (const name of REACT_NATIVE_PRELOAD) void ReactNative[name];
}
