import { useMutation, useQueryClient } from "@tanstack/react-query";

import { myCoachesRootKey } from "@/entities/coach-relationship";
import { incomingInvitationsRootKey } from "@/entities/incoming-coach-invitation";
import { callWithSession } from "@/entities/session";
import {
  acceptMyIncomingCoachInvitation,
  declineMyIncomingCoachInvitation,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type {
  CoachInvitationAcceptResponseOutcome,
  IncomingCoachInvitationAcceptRequestDocumentLanguage,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * Answering an incoming coach invitation by its id (SF-73; the SF-72 shared
 * acceptance policy, simplefit-api ADR 0022). The backend owns every rule:
 * who may answer (a verified email identity of the invited address, from
 * the session), the prerequisites, the exact current disclosure version and
 * the language of its approved text, the fighter's age (18+), and the
 * relationship and evidence it records in one transaction. The app previews,
 * submits the fighter's explicit choice with the version and language that
 * were shown, and reports only what the backend answered.
 */

/**
 * Why a preview or response failed, from the status and code only (never
 * the message):
 * - `sharing`: `404`, Coach–Fighter sharing is not available (legal gate);
 * - `unavailable`: `410`, not a pending invitation of this account (unknown,
 *   someone else's, answered, cancelled or expired: one answer, no oracle);
 * - `stale` / `language`: `409`, the disclosure version or the language of
 *   the text shown is no longer current;
 * - `tooYoung` / `profile`: `422`, under 18, or account registration or the
 *   fighter profile first;
 * - `limited`: `429`; `failed`: anything else (network included).
 */
export type RespondProblem =
  "sharing" | "unavailable" | "stale" | "language" | "tooYoung" | "profile" | "limited" | "failed";

export function respondProblem(error: unknown): RespondProblem {
  if (!isApiError(error)) return "failed";
  if (error.status === 404) return "sharing";
  if (error.status === 410) return "unavailable";
  if (error.status === 409 && error.details["disclosure_version"] === "stale") return "stale";
  if (error.status === 409 && error.details["document_language"] === "unavailable") {
    return "language";
  }
  if (error.status === 422) {
    const codes = error.fieldCodes;
    if (codes["coaching_age"]?.includes("too_young")) return "tooYoung";
    if (codes["account_registration"] || codes["fighter_profile"]) return "profile";
  }
  if (error.status === 429) return "limited";
  return "failed";
}

export type AcceptOutcome = CoachInvitationAcceptResponseOutcome;

/**
 * `POST …/coach-invitations/{id}/accept` with exactly the disclosure version
 * and the language of the text the fighter was shown. Nothing is shown as
 * accepted before the backend answers; then the inbox, the preview and the
 * fighter's coaches are read again.
 */
export function useAcceptInvitation(invitationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      version,
      language,
    }: {
      version: string;
      language: IncomingCoachInvitationAcceptRequestDocumentLanguage;
    }): Promise<AcceptOutcome> =>
      callWithSession((init) =>
        acceptMyIncomingCoachInvitation(
          invitationId,
          { disclosure_version: version, document_language: language },
          init,
        ),
      ).then((response) => response.outcome),
    onSettled: () => refresh(client, true),
  });
}

/**
 * `POST …/coach-invitations/{id}/decline` (allowed even while sharing is
 * off: it grants nothing). `declined` only on the backend's `204`; an
 * invitation that is no longer pending answers `410` (`unavailable`), never
 * shown as declined.
 */
export function useDeclineInvitation(invitationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<"declined" | "unavailable"> => {
      try {
        await callWithSession((init) => declineMyIncomingCoachInvitation(invitationId, init));
        return "declined";
      } catch (error) {
        if (isApiError(error) && error.status === 410) return "unavailable";
        throw error;
      }
    },
    onSettled: () => refresh(client, false),
  });
}

/**
 * After an answer (or a failure, which may follow a change elsewhere) the
 * inbox and, after an acceptance, the coaches are read again. The preview
 * is not: the review screen shows the outcome, and the preview is never
 * kept once that screen is left (`gcTime: 0`).
 */
function refresh(client: ReturnType<typeof useQueryClient>, coaches: boolean) {
  return Promise.all([
    client.invalidateQueries({ queryKey: incomingInvitationsRootKey }),
    coaches ? client.invalidateQueries({ queryKey: myCoachesRootKey }) : undefined,
  ]);
}
