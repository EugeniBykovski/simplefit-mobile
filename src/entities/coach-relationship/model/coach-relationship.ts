import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getListMyCoachesQueryKey,
  listMyCoaches,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type {
  MyCoachRelationship,
  MyCoachRelationshipDisclosedFieldsItem,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * The signed-in fighter's coaching relationships (SF-56; simplefit-api ADR
 * 0021), seen from the fighter's side: each active coach's public identity
 * and the fields of the fighter's profile disclosed to them; for an ended one
 * only the coach's name at the end, the dates and who ended it. The backend
 * owns every relationship and its status: the app keeps nothing of its own,
 * reads fresh on every screen entry and when the app returns to the
 * foreground (an end on the web or another device is reconciled), and the
 * cache is cleared at every session boundary (SF-28).
 */
export type MyCoach = MyCoachRelationship;
export type MyCoachStatus = "active" | "ended";
export type DisclosedField = MyCoachRelationshipDisclosedFieldsItem;

const PAGE_SIZE = 50;
/** The detail scans at most this many pages of 100 active relationships. */
const DETAIL_PAGES = 10;

/** Every query of this entity: invalidated after an end. */
export const myCoachesRootKey = getListMyCoachesQueryKey().slice(0, 1);
export const myCoachesKey = (status: MyCoachStatus) =>
  [...getListMyCoachesQueryKey({ status }), "pages"] as const;
export const myCoachKey = (relationshipId: string) =>
  [...myCoachesRootKey, "relationship", relationshipId] as const;

/** `404` from these endpoints: no completed fighter profile (or not one of the viewer's). */
export const isUnavailable = (error: unknown) => isApiError(error) && error.status === 404;

/** `GET /api/v1/me/coaches?status=…`, page by page (`next_cursor`). */
export function useMyCoaches(status: MyCoachStatus) {
  return useInfiniteQuery({
    queryKey: myCoachesKey(status),
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyCoaches(
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
 * One active relationship, verified against the backend. Fighters have no
 * single-relationship read, so the id is looked up in the active list; an id
 * that is not there (ended, someone else's, unknown) resolves to `null`.
 * The route parameter alone never authorizes anything.
 */
export function useMyCoach(relationshipId: string) {
  return useQuery({
    queryKey: myCoachKey(relationshipId),
    queryFn: async ({ signal }): Promise<MyCoach | null> => {
      let cursor: string | null = null;
      for (let page = 0; page < DETAIL_PAGES; page += 1) {
        const { relationships, next_cursor } = await callWithSession((init) =>
          listMyCoaches(
            { status: "active", limit: 100, ...(cursor ? { cursor } : {}) },
            { ...init, signal },
          ),
        );
        const found = relationships.find((item) => item.relationship_id === relationshipId);
        if (found) return found;
        if (next_cursor === null) return null;
        cursor = next_cursor;
      }
      return null;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
