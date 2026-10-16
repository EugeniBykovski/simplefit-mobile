import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getGetMyCoachFighterQueryKey,
  getListMyCoachFightersQueryKey,
  getMyCoachFighter,
  listMyCoachFighters,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type {
  CoachFighterRelationship,
  CoachFighterRelationshipDisclosedFieldsItem,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * The signed-in coach's relationships with fighters (SF-56; simplefit-api
 * ADR 0021), seen from the coach's side: for an active one only the C1+C2
 * fields the fighter disclosed; for an ended one only the dates, who ended it
 * and the fighter's name at the end. The backend owns every relationship and
 * every authorization decision: nothing is kept on the device, lists are read
 * fresh on every entry and when the app returns to the foreground, and the
 * cache is cleared at every session boundary (SF-28). The same records as
 * the web roster (SF-58).
 */
export type CoachFighter = CoachFighterRelationship;
export type CoachFighterStatus = "active" | "ended";
export type DisclosedField = CoachFighterRelationshipDisclosedFieldsItem;

const PAGE_SIZE = 50;

/** Every roster query: invalidated after an end. */
export const coachFightersRootKey = getListMyCoachFightersQueryKey().slice(0, 1);
export const coachFightersKey = (status: CoachFighterStatus) =>
  [...getListMyCoachFightersQueryKey({ status }), "pages"] as const;
export const coachFighterKey = (relationshipId: string) =>
  getGetMyCoachFighterQueryKey(relationshipId);

/**
 * `404` from these endpoints: Coach–Fighter sharing is off, the viewer has no
 * completed coach profile, or (detail) the relationship is ended, someone
 * else's or unknown. One answer, so nothing is revealed.
 */
export const isUnavailable = (error: unknown) => isApiError(error) && error.status === 404;

/** `GET /api/v1/me/coach/fighters?status=…`, page by page (`next_cursor`). */
export function useCoachFighters(status: CoachFighterStatus) {
  return useInfiniteQuery({
    queryKey: coachFightersKey(status),
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyCoachFighters(
          { status, limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          { ...init, signal },
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * `GET /api/v1/me/coach/fighters/{id}`: one active relationship of this
 * coach. The route parameter authorizes nothing; the backend answers `404`
 * for anything else.
 */
export function useCoachFighter(relationshipId: string) {
  return useQuery({
    queryKey: coachFighterKey(relationshipId),
    queryFn: ({ signal }) =>
      callWithSession((init) => getMyCoachFighter(relationshipId, { ...init, signal })).then(
        (response) => response.relationship,
      ),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
