// Native modules are replaced with in-memory or controllable fakes. Matchers
// from @testing-library/react-native are registered automatically.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

// Native Google Sign-In (SF-22). Real Google is verified manually only.
jest.mock("@react-native-google-signin/google-signin", () => ({
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
  },
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: "cancelled", data: null })),
    signOut: jest.fn(async () => null),
  },
  isSuccessResponse: (response: { type: string }) => response.type === "success",
  isErrorWithCode: (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error,
}));

// Native Sign in with Apple and crypto (SF-23). Real Apple is verified manually only.
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(async () => {
    throw Object.assign(new Error("The user canceled the authorization attempt"), {
      code: "ERR_REQUEST_CANCELED",
    });
  }),
}));

jest.mock("expo-crypto", () => {
  const { createHash, randomBytes } = require("node:crypto");
  return {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    CryptoEncoding: { HEX: "hex" },
    getRandomBytes: jest.fn((count: number) => new Uint8Array(randomBytes(count))),
    digestStringAsync: jest.fn(async (_algorithm: string, data: string) =>
      createHash("sha256").update(data).digest("hex"),
    ),
  };
});

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageTag: "en-US", languageCode: "en" }]),
  getCalendars: jest.fn(() => [{ timeZone: "UTC" }]),
}));

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

beforeEach(async () => {
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await AsyncStorage.clear();
  require("expo-secure-store").__store.clear();
  const localization = require("expo-localization");
  localization.getLocales.mockImplementation(() => [{ languageTag: "en-US", languageCode: "en" }]);
  localization.getCalendars.mockImplementation(() => [{ timeZone: "UTC" }]);
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
