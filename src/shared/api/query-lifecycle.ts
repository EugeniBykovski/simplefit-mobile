import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

/** React Native has no window focus: an "active" app counts as focused. */
export function onAppStateChange(status: AppStateStatus): void {
  if (Platform.OS !== "web") focusManager.setFocused(status === "active");
}

/**
 * Connects TanStack Query to the device's connectivity. While offline, queries
 * pause instead of failing, and resume (refetchOnReconnect) when back online.
 * Called once at startup.
 */
export function connectOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return () => subscription.remove();
  });
}

/** Refetches stale queries when the app returns to the foreground. */
export function useAppStateFocus(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);
}
