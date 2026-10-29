import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { callWithSession } from "@/entities/session";
import {
  completeGymFirstRun,
  dismissGymFirstRun,
  getGetGymFirstRunQueryKey,
  getGymFirstRun,
  startGymFirstRun,
} from "@/shared/api/generated/endpoints/gyms/gyms";
import type {
  GymChecklistItem as GymChecklistItemModel,
  GymChecklistItemKey,
  GymChecklistItemStatus,
  GymFirstRun as GymFirstRunModel,
  GymFirstRunStatus,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * The owner's first run at one gym and the gym's setup checklist (SF-90;
 * simplefit-api ADR 0026, SF-90 amendment), the same contract as the web
 * client's (SF-91): `GET /api/v1/gyms/{gym_id}/first-run`.
 *
 * - One state per gym and owner, shared by every client: a tour started on
 *   the web is "in progress" here. The cache only ever holds the backend's
 *   latest answer for that gym (one query key per gym id); nothing is kept on
 *   the device and nothing is written optimistically. The session boundary
 *   clears the cache (SF-28).
 * - `completed` and `dismissed` are final; the backend never reopens them.
 *   `unavailable` is a draft gym (no first run until setup completes).
 * - The checklist is the backend's projection of the gym's own records: the
 *   app renders it and never sets it. Finishing or skipping the introduction
 *   changes no item.
 * - Owner only (`manage_first_run`): callers ask for it only when the viewer's
 *   permission projection holds it; other staff get 403 and never call.
 */
export type GymFirstRun = GymFirstRunModel;
export type GymFirstRunState = GymFirstRunStatus;
export type GymChecklistItem = GymChecklistItemModel;
export type GymChecklistKey = GymChecklistItemKey;
export type GymChecklistState = GymChecklistItemStatus;
export type GymFirstRunAction = "start" | "complete" | "dismiss";

/** The permission that opens the first run (owner only, SF-90). */
export const FIRST_RUN_PERMISSION = "manage_first_run";

/** Whether the backend keeps this introduction for good. */
export const isFinal = (status: GymFirstRunState) =>
  status === "completed" || status === "dismissed";

export const gymFirstRunQueryKey = (gymId: string) => getGetGymFirstRunQueryKey(gymId);

/** `GET /api/v1/gyms/{gym_id}/first-run`. */
export async function fetchGymFirstRun(gymId: string, signal?: AbortSignal): Promise<GymFirstRun> {
  const { first_run } = await callWithSession((init) => getGymFirstRun(gymId, { ...init, signal }));
  return first_run;
}

/**
 * The first run of one gym, for its owner (`enabled` only with the
 * permission). Re-read when the app returns to the foreground (focusManager)
 * and when the network comes back, so an introduction started, finished or
 * skipped on another device is picked up.
 */
export function useGymFirstRun(gymId: string, enabled: boolean) {
  return useQuery({
    queryKey: gymFirstRunQueryKey(gymId),
    queryFn: ({ signal }) => fetchGymFirstRun(gymId, signal),
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

const CALLS = {
  start: startGymFirstRun,
  complete: completeGymFirstRun,
  dismiss: dismissGymFirstRun,
} as const;

/** The other outcome is already kept (`409 conflict`, `details.first_run`). */
export function isFirstRunConflict(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && "first_run" in error.details;
}

/**
 * Whether a failed request may still have been applied: no answer (offline,
 * timeout, a lost response) or a server error. A 4xx was refused for sure.
 */
const uncertain = (error: unknown) =>
  !isApiError(error) || error.kind !== "http" || error.status >= 500;

/**
 * Explicit transitions (`POST …/first-run/start|complete|dismiss`, empty
 * body). Each resolves with the state the backend keeps, which becomes the
 * cache entry of that gym; repeating one is safe (the backend returns the
 * same state). Callers compare the kept status with the one they asked for:
 *
 * - **409** (the other outcome was kept elsewhere): the state is read again
 *   and returned, so the caller shows what the server kept, never a guess.
 * - **Uncertain** (no answer, 5xx) for an ending: the state is read again; a
 *   final state is the answer (the request, or another device, ended it).
 *   Otherwise, or when that read fails too, it rejects with the original
 *   error and nothing is shown as saved.
 * - Anything else rejects.
 */
export function useGymFirstRunActions(gymId: string) {
  const client = useQueryClient();
  return useCallback(
    async (action: GymFirstRunAction): Promise<GymFirstRun> => {
      const reread = () =>
        client.fetchQuery({
          queryKey: gymFirstRunQueryKey(gymId),
          queryFn: ({ signal }) => fetchGymFirstRun(gymId, signal),
          staleTime: 0,
        });
      try {
        const { first_run } = await callWithSession((init) => CALLS[action](gymId, {}, init));
        if (first_run.gym_id === gymId) client.setQueryData(gymFirstRunQueryKey(gymId), first_run);
        return first_run;
      } catch (error) {
        if (isFirstRunConflict(error)) return reread();
        if (action !== "start" && uncertain(error)) {
          const kept = await reread().catch(() => undefined);
          if (kept !== undefined && isFinal(kept.status)) return kept;
        }
        throw error;
      }
    },
    [client, gymId],
  );
}
