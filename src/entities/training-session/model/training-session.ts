import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getGetMyCoachTrainingSessionQueryKey,
  getListMyCoachTrainingSessionsQueryKey,
  getMyCoachTrainingSession,
  listMyCoachTrainingSessions,
} from "@/shared/api/generated/endpoints/training/training";
import {
  CoachTrainingSessionTrainingType,
  type CoachTrainingSession as CoachTrainingSessionDto,
  type CoachTrainingSessionStatus,
  type ListMyCoachTrainingSessionsView,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";
import { isResourceId } from "@/shared/lib/ids";

/**
 * A training session as the backend projects it for its coach (SF-62,
 * SF-63; simplefit-api ADR 0023): one planned training for one fighter of an
 * active relationship, `planned` until the fighter completes it or it is
 * cancelled (by the coach, or by the system when the relationship ends). The
 * backend owns every status, time and permission; nothing here derives one,
 * and a planned session whose time has passed stays `planned`, never
 * "completed". Nothing is kept on the device: lists are read fresh on every
 * entry and when the app returns to the foreground, and the cache is cleared
 * at every session boundary (SF-28). The same records as the web planner
 * (SF-64).
 */
export type CoachTrainingSession = CoachTrainingSessionDto;
export type TrainingSessionStatus = CoachTrainingSessionStatus;
export type TrainingSessionView = ListMyCoachTrainingSessionsView;
export type TrainingType = CoachTrainingSessionTrainingType;
/** History narrowed to one terminal status, or `all` (completed, cancelled and past due). */
export type TrainingSessionFilter = "all" | "completed" | "cancelled";

/** The five training types, in the order the form offers them. */
export const TRAINING_TYPES = Object.values(CoachTrainingSessionTrainingType);

const PAGE_SIZE = 50;

/** The prefix of every coach session list (invalidated after any change). */
export const coachTrainingSessionsRootKey = getListMyCoachTrainingSessionsQueryKey().slice(0, 1);

/** One session of the coach. */
export const coachTrainingSessionKey = (sessionId: string) =>
  getGetMyCoachTrainingSessionQueryKey(sessionId);

const listParams = (view: TrainingSessionView, filter: TrainingSessionFilter) =>
  view === "history" && filter !== "all" ? { view, status: filter } : { view };

/** The key of one projection (`upcoming`, or `history` with its filter), paged by cursor. */
export const coachTrainingSessionsKey = (
  view: TrainingSessionView,
  filter: TrainingSessionFilter = "all",
) => [...getListMyCoachTrainingSessionsQueryKey(listParams(view, filter)), "pages"] as const;

/**
 * `404` from these endpoints: planning is not available (no completed coach
 * profile, or Coach–Fighter sharing switched off) or, for one session, it is
 * unknown, someone else's or its relationship ended. One answer, so nothing
 * is revealed.
 */
export const isUnavailable = (error: unknown) => isApiError(error) && error.status === 404;

/**
 * The coach's sessions in one projection the backend computes with its own
 * clock: `upcoming` (planned and not yet over, earliest first) or `history`
 * (completed, cancelled and past-due planned, newest first; `filter` narrows
 * it to one status). One cursor page at a time.
 */
export function useCoachTrainingSessions(
  view: TrainingSessionView,
  filter: TrainingSessionFilter = "all",
) {
  return useInfiniteQuery({
    queryKey: coachTrainingSessionsKey(view, filter),
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyCoachTrainingSessions(
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
 * One session of the coach (`GET /api/v1/me/coach/training-sessions/{id}`).
 * The route parameter authorizes nothing: an id that is not a UUID is never
 * sent and resolves to `null` (shown as not available, like the backend's
 * `404`).
 */
export function useCoachTrainingSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: coachTrainingSessionKey(sessionId ?? ""),
    queryFn: async ({ signal }): Promise<CoachTrainingSession | null> => {
      if (!isResourceId(sessionId)) return null;
      const response = await callWithSession((init) =>
        getMyCoachTrainingSession(sessionId, { ...init, signal }),
      );
      return response.training_session;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * How a session's fighter is named: the display name, else `@username`,
 * else `null` (the fighter disclosed neither, or the relationship ended).
 */
export function fighterLabel(fighter: CoachTrainingSession["fighter"]): string | null {
  if (fighter === null) return null;
  if (fighter.display_name) return fighter.display_name;
  return fighter.username ? `@${fighter.username}` : null;
}
