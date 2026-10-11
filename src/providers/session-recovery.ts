import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { retryUnavailableSession } from "@/entities/session";

/**
 * A session that could not be confirmed (no network, or the API failed:
 * `unavailable`) is retried when the app returns to the foreground or the
 * device comes back online (SF-28), so the app never stays on the
 * "couldn't check your session" view once it could succeed. Signed-in and
 * signed-out sessions are left alone, and the view's own Retry still works.
 */
export function useSessionRecovery(): void {
  useEffect(() => {
    const appState = AppState.addEventListener("change", (status) => {
      if (status === "active") retryUnavailableSession();
    });
    const online = onlineManager.subscribe((isOnline) => {
      if (isOnline) retryUnavailableSession();
    });
    return () => {
      appState.remove();
      online();
    };
  }, []);
}
