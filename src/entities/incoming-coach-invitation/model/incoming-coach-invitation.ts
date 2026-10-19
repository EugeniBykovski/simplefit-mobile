import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale } from "use-intl";

import { callWithSession } from "@/entities/session";
import {
  getListMyIncomingCoachInvitationsQueryKey,
  getPreviewMyIncomingCoachInvitationQueryKey,
  listMyIncomingCoachInvitations,
  previewMyIncomingCoachInvitation,
} from "@/shared/api/generated/endpoints/coaching/coaching";
import type {
  CoachInvitationPreview,
  IncomingCoachInvitation as IncomingCoachInvitationDto,
} from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";
import { isResourceId } from "@/shared/lib/ids";

/**
 * The coach invitations addressed to the signed-in user (SF-73; simplefit-api
 * ADR 0021, 0022): those sent to one of their verified email identities,
 * matched on the server from the session alone. The backend owns every
 * invitation and its effective status (`pending`, `accepted`, `declined`,
 * `cancelled`, `expired`); the app keeps nothing of its own, reads fresh on
 * every screen entry and when the app returns to the foreground, and the
 * cache is cleared at every session boundary (SF-28). No token, recipient
 * address or digest ever reaches the app.
 */
export type IncomingCoachInvitation = IncomingCoachInvitationDto;
export type InvitationPreview = CoachInvitationPreview;

const PAGE_SIZE = 50;

/** Every query of this entity: invalidated after a response. */
export const incomingInvitationsRootKey = getListMyIncomingCoachInvitationsQueryKey().slice(0, 1);
export const incomingInvitationsKey = [...incomingInvitationsRootKey, "pages"] as const;
export const invitationPreviewKey = (invitationId: string, language: string) =>
  getPreviewMyIncomingCoachInvitationQueryKey(invitationId, { language });

/**
 * What a failed read means, from the status alone. `sharing`: `404`, Coach–
 * Fighter sharing is not available (the legal gate, ADR 0022), never an
 * empty inbox. `profile`: `422`, the account registration comes first.
 */
export type InboxProblem = "sharing" | "profile" | "failed";

export function inboxProblem(error: unknown): InboxProblem {
  if (isApiError(error) && error.status === 404) return "sharing";
  if (isApiError(error) && error.status === 422) return "profile";
  return "failed";
}

/** `GET /api/v1/me/coach-invitations`, newest first, page by page (`next_cursor`). */
export function useIncomingInvitations() {
  return useInfiniteQuery({
    queryKey: incomingInvitationsKey,
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyIncomingCoachInvitations(
          { limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
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
 * `GET /api/v1/me/coach-invitations/{id}/preview?language=<app language>`:
 * the coach's public identity, the note, the expiry, the current disclosure
 * (version, fields, never-shared categories) and its approved text in the
 * app language (`document`; metadata only when that language has no
 * approved variant, never another language). An id that is not a UUID is not
 * sent and resolves to `null`; the route parameter authorizes nothing.
 * Never kept once the review screen is left (`gcTime: 0`): a reopened
 * invitation never shows a status the backend no longer holds.
 */
export function useInvitationPreview(invitationId: string | undefined) {
  const language = useLocale();
  return useQuery({
    queryKey: invitationPreviewKey(invitationId ?? "", language),
    queryFn: async ({ signal }): Promise<InvitationPreview | null> => {
      if (!isResourceId(invitationId)) return null;
      return callWithSession((init) =>
        previewMyIncomingCoachInvitation(invitationId, { language }, { ...init, signal }),
      );
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}
