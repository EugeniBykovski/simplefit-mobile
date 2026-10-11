import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { onSessionBoundary } from "@/entities/session";

/**
 * Server state belongs to the signed-in user (SF-26, SF-28): whenever the
 * session ends or a sign-in starts a new one on this device, the session runs
 * this before publishing the new state, so nobody ever sees another account's
 * cached profile, onboarding state or entry, not even for one render.
 * In-flight queries are cancelled; their late answers are discarded by the
 * session (`SessionChangedError`). A refresh of the same session, or a session
 * that is only `unavailable` (no network), keeps its cache.
 */
export function useSessionScopedCache(client: QueryClient): void {
  useEffect(
    () =>
      onSessionBoundary(() => {
        void client.cancelQueries();
        client.clear();
      }),
    [client],
  );
}
