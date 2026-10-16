import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coachInvitationsKey } from "@/entities/coach-invitation";
import { callWithSession } from "@/entities/session";
import {
  cancelMyCoachInvitation,
  resendMyCoachInvitation,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * Resend and cancel one of the coach's invitations (SF-57). The backend owns
 * the cooldown, the resend limit and the lifecycle; a resend rotates the
 * token on the server, which the app never sees. Every answer refetches the
 * list, so the status shown is always the backend's.
 */
export type ActionProblem =
  | { kind: "cooldown"; seconds: number }
  | { kind: "noResends" }
  | { kind: "notPending" }
  | { kind: "failed" };

export function actionProblem(error: unknown): ActionProblem {
  if (!isApiError(error)) return { kind: "failed" };
  if (error.status === 429) return { kind: "cooldown", seconds: error.retryAfterSeconds ?? 60 };
  if (error.status === 409 && error.details["resends"] === "limit_reached")
    return { kind: "noResends" };
  if (error.status === 409 || error.status === 404) return { kind: "notPending" };
  return { kind: "failed" };
}

export function useInvitationActions() {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: coachInvitationsKey });
  const resend = useMutation({
    mutationFn: (id: string) => callWithSession((init) => resendMyCoachInvitation(id, init)),
    onSettled: settle,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => callWithSession((init) => cancelMyCoachInvitation(id, init)),
    onSettled: settle,
  });
  return { resend, cancel };
}
