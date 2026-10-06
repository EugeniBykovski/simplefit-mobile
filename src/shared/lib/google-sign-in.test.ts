/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules loads modules with require() */
const missingNativeModule = () => {
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found.");
};

/** Loads modules as a binary without RNGoogleSignin would (e.g. Expo Go). */
function withoutNativeModule<T>(load: () => T): T {
  let loaded: T | undefined;
  jest.isolateModules(() => {
    jest.doMock("@react-native-google-signin/google-signin", missingNativeModule);
    jest.doMock("expo-router", () => ({ useRouter: jest.fn() }));
    loaded = load();
  });
  return loaded as T;
}

describe("Google Sign-In native boundary", () => {
  it("never evaluates the native module when screens are imported", () => {
    expect(() =>
      withoutNativeModule(() => [
        require("@/widgets/foundation-home"),
        require("@/widgets/auth-screens"),
      ]),
    ).not.toThrow();
  });

  it("fails loudly on use when the binary lacks the native module", () => {
    const { googleSignInModule } = withoutNativeModule(() => require("./google-sign-in"));

    expect(() => googleSignInModule()).toThrow(/RNGoogleSignin/);
  });
});
