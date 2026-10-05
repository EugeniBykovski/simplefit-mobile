const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// NativeWind compiles src/global.css (Tailwind) into React Native styles.
// inlineRem: Tailwind's spacing and sizing scale is defined in rem; NativeWind
// defaults to 1 rem = 14 pt on native, which would render every step 12.5%
// smaller than the shared scale (docs/design-tokens.json, 1 step = 4 px).
// 16 keeps mobile pixel-identical to the web and to the Claude Design source.
module.exports = withNativeWind(getDefaultConfig(__dirname), {
  input: "./src/global.css",
  inlineRem: 16,
});
