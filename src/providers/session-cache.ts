import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSession } from "@/entities/session";

/**
 * Server state belongs to the signed-in user (SF-26): when the session ends,
 * or a different user signs in on this device, the query cache is cleared, so
 * nobody ever sees another account's cached profile, onboarding state or
 * entry, even for one render. A session that is only `unavailable` (no
 * network) keeps its user and its cache.
 */
export function useSessionScopedCache(client: QueryClient): void {
  const { status, viewer } = useSession();
  const owner = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (status === "anonymous") {
      if (owner.current !== undefined) client.clear();
      owner.current = undefined;
      return;
    }
    if (status !== "authenticated" || viewer === undefined) return;
    if (owner.current !== undefined && owner.current !== viewer.id) client.clear();
    owner.current = viewer.id;
  }, [client, status, viewer]);
}
