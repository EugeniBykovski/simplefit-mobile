import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coachDataRulesKey, coachInvitationsKey } from "@/entities/coach-invitation";
import { callWithSession } from "@/entities/session";
import {
  acknowledgeMyCoachDataRules,
  createMyCoachInvitation,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type { CoachDataRulesAcknowledgeRequestDocumentLanguage } from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * Inviting a fighter (SF-57), from the coach's side. The backend owns every
 * rule: whether the coach data rules are acknowledged, the address checks,
 * the limits, and whether a pending invitation to the address is reused.
 * Nothing here creates a user, profile or relationship.
 */

/** What went wrong, from the status and code only (never the message). */
export type InviteProblem =
  | { kind: "email"; own: boolean }
  | { kind: "note" }
  | { kind: "limited"; minutes: number }
  | { kind: "pendingLimit" }
  | { kind: "rules" }
  | { kind: "blocked" }
  | { kind: "failed" };

export function inviteProblem(error: unknown): InviteProblem {
  if (!isApiError(error)) return { kind: "failed" };
  if (error.code === "validation_error") {
    const codes = error.fieldCodes;
    // SF-57: `invalid` is only the coach's own verified address; a malformed
    // one is `format` (or `required` / `length`).
    if (codes["email"]) return { kind: "email", own: codes["email"].includes("invalid") };
    if (codes["message"]) return { kind: "note" };
    return { kind: "failed" };
  }
  if (error.code === "rate_limited") {
    return {
      kind: "limited",
      minutes: Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)),
    };
  }
  if (error.code === "conflict" && error.details["pending_invitations"] === "limit_reached") {
    return { kind: "pendingLimit" };
  }
  if (error.code === "conflict" && error.details["data_rules_acknowledgement"] === "required") {
    return { kind: "rules" };
  }
  if (error.status === 404) return { kind: "blocked" };
  return { kind: "failed" };
}

/** `POST …/invitations`: the backend's invitation (created, or the pending one reused). */
export function useCreateInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, note }: { email: string; note: string }) =>
      callWithSession((init) =>
        createMyCoachInvitation(
          { email: email.trim(), ...(note.trim() === "" ? {} : { message: note.trim() }) },
          init,
        ),
      ).then((response) => response.invitation),
    onSettled: () => client.invalidateQueries({ queryKey: coachInvitationsKey }),
  });
}

/**
 * What acknowledging answered: done, a newer version is current, the text's
 * language has no approved variant (any more), or not available.
 */
export type AcknowledgeOutcome = "acknowledged" | "stale" | "language" | "blocked";

/**
 * `POST …/data-rules/acknowledge` with exactly the version and the language of
 * the text the coach was shown (SF-72).
 */
export function useAcknowledgeDataRules() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      version,
      language,
    }: {
      version: string;
      language: CoachDataRulesAcknowledgeRequestDocumentLanguage;
    }): Promise<AcknowledgeOutcome> => {
      try {
        await callWithSession((init) =>
          acknowledgeMyCoachDataRules(
            { document_version: version, document_language: language },
            init,
          ),
        );
        return "acknowledged";
      } catch (error) {
        if (isApiError(error) && error.status === 409) {
          return error.details["document_language"] === "unavailable" ? "language" : "stale";
        }
        if (isApiError(error) && error.status === 404) return "blocked";
        throw error;
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: coachDataRulesKey }),
  });
}
