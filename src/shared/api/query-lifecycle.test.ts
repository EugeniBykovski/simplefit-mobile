import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";

import { connectOnlineManager, onAppStateChange } from "./query-lifecycle";

describe("query lifecycle", () => {
  it("treats the active app state as focused", () => {
    onAppStateChange("background");
    expect(focusManager.isFocused()).toBe(false);
    onAppStateChange("active");
    expect(focusManager.isFocused()).toBe(true);
  });

  it("follows device connectivity", () => {
    connectOnlineManager();
    const listener = jest.mocked(Network.addNetworkStateListener).mock.calls.at(-1)?.[0];
    expect(listener).toBeDefined();

    listener?.({ isConnected: false } as never);
    expect(onlineManager.isOnline()).toBe(false);
    listener?.({ isConnected: true } as never);
    expect(onlineManager.isOnline()).toBe(true);
  });
});
