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
