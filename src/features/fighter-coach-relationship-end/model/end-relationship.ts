import { useMutation, useQueryClient } from "@tanstack/react-query";

import { myCoachKey, myCoachesRootKey } from "@/entities/coach-relationship";
import { callWithSession } from "@/entities/session";
import { endMyCoachRelationship } from "@/shared/api/generated/endpoints/coaching/coaching";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * What the backend answered to ending a relationship (`POST
 * /api/v1/me/coaches/{id}/end`, SF-56). `ended` is its `204`: the
 * relationship is ended (idempotent: an already ended one of the viewer's
 * answers `204` too, keeping its original end). `unavailable` is its `404`:
 * not a relationship this fighter can reach. It proves nothing about this
 * request, so it is never reported as "ended".
 */
export type EndOutcome = "ended" | "unavailable";

/**
 * Ends one of the fighter's coaching relationships. Nothing is removed or
 * shown as ended before the backend answers; either answer then drops the
 * cached relationship and refetches every list, so the coach is gone from
 * the screen exactly when the backend says so. Other relationships are
 * untouched: only this id is sent.
 */
export function useEndMyCoach() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (relationshipId: string): Promise<EndOutcome> => {
      try {
        await callWithSession((init) => endMyCoachRelationship(relationshipId, init));
        return "ended";
      } catch (error) {
        if (isApiError(error) && error.status === 404) return "unavailable";
        throw error;
      }
    },
    onSuccess: async (_outcome, relationshipId) => {
      client.removeQueries({ queryKey: myCoachKey(relationshipId) });
      await client.invalidateQueries({ queryKey: myCoachesRootKey });
    },
  });
}
