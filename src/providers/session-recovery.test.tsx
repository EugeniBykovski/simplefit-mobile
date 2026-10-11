import { onlineManager } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { retryUnavailableSession } from "@/entities/session";

import { useSessionRecovery } from "./session-recovery";

jest.mock("@/entities/session", () => ({ retryUnavailableSession: jest.fn() }));

describe("session recovery (SF-28)", () => {
  let appStateListener: ((status: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.mocked(retryUnavailableSession).mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener as (status: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
  });

  it("retries an unconfirmed session when the app returns to the foreground", async () => {
    await renderHook(() => useSessionRecovery());
    appStateListener?.("background");
    expect(retryUnavailableSession).not.toHaveBeenCalled();
    appStateListener?.("active");
    expect(retryUnavailableSession).toHaveBeenCalledTimes(1);
  });

  it("retries when the device comes back online", async () => {
    await renderHook(() => useSessionRecovery());
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    expect(retryUnavailableSession).toHaveBeenCalledTimes(1);
  });
});
