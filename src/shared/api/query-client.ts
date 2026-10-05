import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "./http/api-error";

const MAX_RETRIES = 2;

/**
 * Client errors (4xx) are deterministic: retrying will not change the answer.
 * 401/403 are left to the future auth layer (refresh, sign-out), never retried.
 * Network failures, timeouts and 5xx are retried a bounded number of times.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        // Mobile: refetch when the app returns to the foreground (focusManager)
        // and when connectivity returns (onlineManager); see query-lifecycle.ts.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations are not idempotent by default: never retry automatically.
        retry: false,
      },
    },
  });
}
