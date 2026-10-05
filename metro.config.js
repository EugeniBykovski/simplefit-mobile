const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// NativeWind compiles src/global.css (Tailwind) into React Native styles.
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./src/global.css" });
