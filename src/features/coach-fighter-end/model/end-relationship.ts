import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coachFighterKey, coachFightersRootKey } from "@/entities/coach-fighter";
import { callWithSession } from "@/entities/session";
import { endMyCoachFighterRelationship } from "@/shared/api/generated/endpoints/coaching/coaching";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * What the backend answered to ending a relationship (`POST
 * /api/v1/me/coach/fighters/{id}/end`, SF-56): `ended` is its `204`;
 * `unavailable` is its `404` (already ended elsewhere, not this coach's, or
 * unknown), which proves nothing about this request and is never reported
 * as "ended".
 */
export type EndOutcome = "ended" | "unavailable";

/**
 * Ends one of the coach's relationships: only this id is sent, so other
 * fighters are untouched. After either answer the cached fighter detail (the
 * private disclosed fields) is dropped and every roster list refetched.
 */
export function useEndCoachFighter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (relationshipId: string): Promise<EndOutcome> => {
      try {
        await callWithSession((init) => endMyCoachFighterRelationship(relationshipId, init));
        return "ended";
      } catch (error) {
        if (isApiError(error) && error.status === 404) return "unavailable";
        throw error;
      }
    },
    onSuccess: async (_outcome, relationshipId) => {
      client.removeQueries({ queryKey: coachFighterKey(relationshipId) });
      await client.invalidateQueries({ queryKey: coachFightersRootKey });
    },
  });
}
