import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { getPreference, setPreference } from "./preferences";
import { deleteSecureItem, getSecureItem, setSecureItem } from "./secure-storage";

describe("secure storage", () => {
  it("stores, reads and deletes values device-only while unlocked", async () => {
    await setSecureItem("example.secret", "value");
    expect(await getSecureItem("example.secret")).toBe("value");
    await deleteSecureItem("example.secret");
    expect(await getSecureItem("example.secret")).toBeNull();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("example.secret", "value", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it("rejects keys SecureStore cannot store", async () => {
    await expect(setSecureItem("bad key/with spaces", "v")).rejects.toThrow(
      /Invalid secure storage key/,
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("preferences", () => {
  it("stores, reads and removes non-sensitive preferences", async () => {
    await setPreference("locale", "pl");
    expect(await getPreference("locale")).toBe("pl");
    expect(await AsyncStorage.getItem("simplefit.preferences.locale")).toBe("pl");
    await setPreference("locale", null);
    expect(await getPreference("locale")).toBeNull();
  });

  it("treats unreadable storage as no preference", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await getPreference("locale")).toBeNull();
  });
});
