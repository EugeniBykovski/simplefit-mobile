import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useRef } from "react";

import { coachFightersRootKey } from "@/entities/coach-fighter";
import { callWithSession, SessionChangedError } from "@/entities/session";
import {
  coachTrainingSessionKey,
  coachTrainingSessionsRootKey,
  type CoachTrainingSession,
} from "@/entities/training-session";
import {
  createMyCoachTrainingSession,
  updateMyCoachTrainingSession,
} from "@/shared/api/generated/endpoints/training/training";
import type {
  TrainingSessionCreateRequest,
  TrainingSessionUpdateRequest,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

export type CreateBody = Omit<TrainingSessionCreateRequest, "client_request_id">;

/**
 * Whether a failed create may have been stored anyway: no answer at all
 * (offline, timeout, a lost response) or a server error. A `4xx` answer
 * means the backend refused it and stored nothing.
 */
export const isUncertain = (error: unknown) =>
  !(error instanceof SessionChangedError) &&
  (!isApiError(error) || error.kind !== "http" || error.status >= 500);

/**
 * The idempotency key of a create (SF-62, ADR 0023): the backend inserts the
 * first create with a key and answers every later one with that session,
 * unchanged (`200`), or `409 client_request_id: reused` when the key names
 * another relationship. It never deduplicates by title, date or fighter.
 *
 * - The same body sent again (a retry) reuses its key.
 * - A changed body is a new attempt with a new key, unless an earlier
 *   attempt's outcome is unknown (`uncertain`): that session may exist, so
 *   the key stays until the backend has answered. A retry then either
 *   creates the session or returns the one stored earlier, which the form
 *   shows as it is: never a silent second session, never a hidden first one.
 */
export function useRequestKey() {
  const last = useRef<{ body: string; key: string; uncertain: boolean } | null>(null);
  return {
    for(body: CreateBody): string {
      const serialized = JSON.stringify(body);
      if (last.current === null) {
        last.current = { body: serialized, key: randomUUID(), uncertain: false };
      } else if (last.current.body !== serialized && !last.current.uncertain) {
        last.current = { body: serialized, key: randomUUID(), uncertain: false };
      } else {
        last.current.body = serialized;
      }
      return last.current.key;
    },
    /** Whether the key belongs to an attempt whose outcome is still unknown. */
    get uncertain(): boolean {
      return last.current?.uncertain ?? false;
    },
    /** Records how the last attempt ended. */
    settle(error: unknown) {
      if (last.current !== null) last.current.uncertain ||= isUncertain(error);
    },
    /** The backend answered for this key: the next attempt starts afresh. */
    reset() {
      last.current = null;
    },
  };
}

/**
 * Whether the session the backend returned is the one this body describes.
 * A repeated key returns the session stored the first time: when the coach
 * changed the form after a lost response, it is not.
 */
export function matchesBody(session: CoachTrainingSession, body: CreateBody): boolean {
  return (
    session.relationship_id === body.relationship_id &&
    session.title === body.title &&
    session.training_type === body.training_type &&
    new Date(session.starts_at).getTime() === new Date(body.starts_at).getTime() &&
    session.time_zone === body.time_zone &&
    session.duration_minutes === body.duration_minutes &&
    (session.notes ?? null) === (body.notes ?? null)
  );
}

async function settle(client: ReturnType<typeof useQueryClient>, session: CoachTrainingSession) {
  client.setQueryData(coachTrainingSessionKey(session.id), session);
  await client.invalidateQueries({ queryKey: coachTrainingSessionsRootKey });
}

/** Creates one session; the caller supplies the body and its request key. */
export function useCreateTrainingSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, key }: { body: CreateBody; key: string }) =>
      callWithSession((init) =>
        createMyCoachTrainingSession({ ...body, client_request_id: key }, init),
      ).then((response) => response.training_session),
    onSuccess: (session) => settle(client, session),
    onError: async (error) => {
      // The relationship is not one the coach can plan for any more: the
      // fighter list is stale.
      if (isApiError(error) && error.status === 404)
        await client.invalidateQueries({ queryKey: coachFightersRootKey });
      // A session may have been stored: the lists show what the backend has.
      if (isUncertain(error))
        await client.invalidateQueries({ queryKey: coachTrainingSessionsRootKey });
    },
  });
}

/** Changes a planned session; `changes` holds only the fields the coach changed. */
export function useUpdateTrainingSession(sessionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: TrainingSessionUpdateRequest) =>
      callWithSession((init) => updateMyCoachTrainingSession(sessionId, changes, init)).then(
        (response) => response.training_session,
      ),
    onSuccess: (session) => settle(client, session),
    onError: async (error) => {
      // Completed or cancelled meanwhile (409), no longer reachable (404), or
      // an unknown outcome: the cached session may be stale.
      if (
        isApiError(error) &&
        error.kind === "http" &&
        error.status < 500 &&
        error.status !== 409 &&
        error.status !== 404
      )
        return;
      await client.invalidateQueries({ queryKey: coachTrainingSessionKey(sessionId) });
      await client.invalidateQueries({ queryKey: coachTrainingSessionsRootKey });
    },
  });
}
