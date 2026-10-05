module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind: className support on React Native components.
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
