import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getGetMyTrainingSessionQueryKey,
  getListMyTrainingSessionsQueryKey,
  getMyTrainingSession,
  listMyTrainingSessions,
} from "@/shared/api/generated/endpoints/training/training";
import type { MyTrainingSession as MyTrainingSessionDto } from "@/shared/api/generated/model";
import { isResourceId } from "@/shared/lib/ids";

import type { TrainingSessionFilter, TrainingSessionView } from "./training-session";

/**
 * A training session as the backend projects it for its fighter (SF-62,
 * SF-63; simplefit-api ADR 0023): the fighter's own sessions, from any
 * coach and in any relationship state (also after it ended), whatever the
 * Coach–Fighter sharing gate. `coach` is the coach's public identity while
 * the relationship is active and `null` after it ended, when only
 * `coach_display_name_at_end` remains. Status, times and completion are the
 * backend's; nothing here derives one. Nothing is kept on the device; the
 * cache is cleared at every session boundary (SF-28).
 */
export type MyTrainingSession = MyTrainingSessionDto;

const PAGE_SIZE = 50;

/** The prefix of every list of the fighter's own sessions (invalidated after a completion). */
export const myTrainingSessionsRootKey = getListMyTrainingSessionsQueryKey().slice(0, 1);

/** One of the fighter's own sessions. */
export const myTrainingSessionKey = (sessionId: string) =>
  getGetMyTrainingSessionQueryKey(sessionId);

const listParams = (view: TrainingSessionView, filter: TrainingSessionFilter) =>
  view === "history" && filter !== "all" ? { view, status: filter } : { view };

/** The key of one projection of the fighter's sessions, paged by cursor. */
export const myTrainingSessionsKey = (
  view: TrainingSessionView,
  filter: TrainingSessionFilter = "all",
) => [...getListMyTrainingSessionsQueryKey(listParams(view, filter)), "pages"] as const;

/**
 * The fighter's sessions in one projection the backend computes with its own
 * clock (`GET /api/v1/me/training-sessions`): `upcoming` (planned and not yet
 * over, earliest first) or `history` (completed, cancelled and past-due
 * planned, newest first; `filter` narrows it to one status). `404` means the
 * viewer has no completed fighter profile.
 */
export function useMyTrainingSessions(
  view: TrainingSessionView,
  filter: TrainingSessionFilter = "all",
) {
  return useInfiniteQuery({
    queryKey: myTrainingSessionsKey(view, filter),
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyTrainingSessions(
          {
            ...listParams(view, filter),
            limit: PAGE_SIZE,
            ...(pageParam === null ? {} : { cursor: pageParam }),
          },
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
 * One of the fighter's own sessions (`GET /api/v1/me/training-sessions/{id}`).
 * Unknown and someone else's are `404` alike; an id that is not a UUID is
 * never sent and resolves to `null`.
 */
export function useMyTrainingSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: myTrainingSessionKey(sessionId ?? ""),
    queryFn: async ({ signal }): Promise<MyTrainingSession | null> => {
      if (!isResourceId(sessionId)) return null;
      const response = await callWithSession((init) =>
        getMyTrainingSession(sessionId, { ...init, signal }),
      );
      return response.training_session;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * How the fighter's session names its coach: the display name (and brand)
 * while the relationship is active, the name at its end afterwards, else
 * `null` (nothing disclosed).
 */
export function coachIdentity(
  session: Pick<MyTrainingSession, "coach" | "coach_display_name_at_end">,
): { name: string | null; brand: string | null; former: boolean } {
  if (session.coach !== null) {
    return {
      name: session.coach.display_name,
      brand: session.coach.brand_name,
      former: false,
    };
  }
  return { name: session.coach_display_name_at_end, brand: null, former: true };
}
