import { isApiError } from "@/shared/api/http/api-error";

/**
 * The production failure states (SF-34). Design source: the Claude Design
 * "System states" sheet (ERROR, OFFLINE, PERMISSION DENIED cards); service
 * unavailable has no artboard and uses the same card in the neutral tone
 * (DESIGN SOURCE: NOT AVAILABLE, FALLBACK: PRODUCTION DS COMPOSITION).
 *
 * `unauthorized` is not a screen: a 401 means the session ended, and the
 * session routing sends the user to sign-in (route-architecture §9, rule 9).
 */
export type FailureKind = "unexpected" | "offline" | "forbidden" | "unavailable";
export type FailureResolution = FailureKind | "unauthorized";

/** Which failure state an error shows; only kind and status are read, never the message. */
export function failureFor(error: unknown): FailureResolution {
  if (!isApiError(error)) return "unexpected";
  if (error.kind === "network" || error.kind === "timeout") return "offline";
  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  if (error.status === 503) return "unavailable";
  return "unexpected";
}

/** Whether trying again can help ("Try again" instead of "Back home"). */
export const isRetryable = (kind: FailureKind) => kind !== "forbidden";
