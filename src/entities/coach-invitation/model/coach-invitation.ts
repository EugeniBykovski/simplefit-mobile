import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getGetMyCoachDataRulesQueryKey,
  getListMyCoachInvitationsQueryKey,
  getMyCoachDataRules,
  listMyCoachInvitations,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type {
  CoachDataRulesResponseDataRules,
  CoachInvitation,
  CoachInvitationStatus,
} from "@/shared/api/generated/model";

/**
 * The coach's invitations (SF-57) and the coach data-rules state that gates
 * inviting. An invitation is never a relationship: a fighter appears in the
 * roster only after accepting. The recipient address is masked by the
 * backend; no token, link or recipient digest ever reaches the app. Status
 * (`expired` included) and every limit are the backend's.
 */
export type { CoachInvitation, CoachInvitationStatus };
export type CoachDataRules = CoachDataRulesResponseDataRules;

const PAGE_SIZE = 50;

export const coachInvitationsKey = [...getListMyCoachInvitationsQueryKey(), "pages"] as const;
export const coachDataRulesKey = getGetMyCoachDataRulesQueryKey();

/** `GET /api/v1/me/coach/invitations`, newest first, page by page. */
export function useCoachInvitations({ enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: coachInvitationsKey,
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyCoachInvitations(
          { limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
          { ...init, signal },
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** `GET /api/v1/me/coach/data-rules`: the version to acknowledge, and when it was. */
export function useCoachDataRules({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: coachDataRulesKey,
    queryFn: ({ signal }) =>
      callWithSession((init) => getMyCoachDataRules({ ...init, signal })).then(
        (response) => response.data_rules,
      ),
    enabled,
    retry: false,
    staleTime: 0,
  });
}
