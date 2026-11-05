import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { gymBookingKey } from "@/entities/gym-booking";
import { callWithSession } from "@/entities/session";
import {
  acceptMyGymInvitation,
  cancelMyGymJoinRequest,
  declineMyGymInvitation,
  joinGym,
  leaveGymMembership,
  listMyGymInvitations,
  previewGymJoin,
} from "@/shared/api/generated/endpoints/gym-members/gym-members";
import type { MyGymInvitation } from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";

/**
 * A person's own side of gym membership (SF-95, SF-135): joining by code, the
 * member invitation inbox, cancelling a request, leaving. The backend owns every
 * rule and status: whether a code works, whether joining waits for the gym or is
 * active at once, and who may do what. This client asks and shows the answer.
 *
 * A code travels only in request bodies. It is never a query key, a route param,
 * a stored value or an automatic retry: every mutation here runs once per press
 * and is not kept after it settles. These operations accept no request key, and
 * none is invented: joining again returns the pending request, and a repeated
 * acceptance answers `already_accepted`, so a retry cannot duplicate one.
 * Staff and coach invitations are other domains and never appear here.
 */
export type GymInboxInvitation = MyGymInvitation;

/**
 * Why something did not happen, from the status and details only:
 *
 * - `notFound` (404): an unknown, malformed, disabled or rotated code, one answer
 *   for all; or a row no longer the viewer's.
 * - `alreadyMember` (409 `gym_member: already_active`).
 * - `changed` (409 another `gym_member` status, or 410): it changed meanwhile.
 * - `registration` (422), `limited` (429), `session` (401).
 * - `unknown`: the connection dropped or the server failed. It may or may not have
 *   been applied, so the lists are read again and nothing is claimed.
 */
export type MembershipProblem =
  | { kind: "notFound" }
  | { kind: "alreadyMember" }
  | { kind: "changed" }
  | { kind: "registration" }
  | { kind: "limited"; minutes: number | null }
  | { kind: "session" }
  | { kind: "unknown" };

export function membershipProblem(error: unknown): MembershipProblem {
  if (!isApiError(error)) return { kind: "unknown" };
  if (error.status === 429) {
    const seconds = error.retryAfterSeconds;
    return {
      kind: "limited",
      minutes: seconds === null ? null : Math.max(1, Math.ceil(seconds / 60)),
    };
  }
  if (error.status === 401) return { kind: "session" };
  if (error.status === 404) return { kind: "notFound" };
  if (error.status === 410) return { kind: "changed" };
  if (error.status === 409) {
    return error.details["gym_member"] === "already_active"
      ? { kind: "alreadyMember" }
      : { kind: "changed" };
  }
  if (error.status === 422 && error.fieldCodes["account_registration"]) {
    return { kind: "registration" };
  }
  return { kind: "unknown" };
}

/** `previewGymJoin`: the gym of a code. It changes nothing. */
export function useGymJoinPreview() {
  return useMutation({
    mutationFn: (code: string) => previewGymJoin({ code }),
    retry: false,
    gcTime: 0,
  });
}

/** `joinGym`: the explicit request. */
export function useJoinGym() {
  return useMutation({
    mutationFn: (code: string) => callWithSession((init) => joinGym({ code }, init)),
    retry: false,
    gcTime: 0,
  });
}

export function useCancelJoinRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (gymMemberId: string) =>
      callWithSession((init) => cancelMyGymJoinRequest(gymMemberId, init)),
    retry: false,
    onSettled: () => client.invalidateQueries({ queryKey: gymBookingKey }),
  });
}

/** Leaving ends the membership; the backend releases its upcoming bookings (SF-99). */
export function useLeaveGym() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (gymMemberId: string) =>
      callWithSession((init) => leaveGymMembership(gymMemberId, init)),
    retry: false,
    onSettled: () => client.invalidateQueries({ queryKey: gymBookingKey }),
  });
}

const PAGE_SIZE = 50;
const inboxKey = [...gymBookingKey, "invitations"] as const;

/**
 * Every member invitation sent to the viewer's verified addresses
 * (`GET /me/gym-invitations`, every page and status), so the inbox can say what
 * became of one. Opening it accepts nothing. It sits under `gymBookingKey`, so the
 * session boundary clears it with the rest of the account's data.
 */
export function useMyGymInvitations() {
  const query = useInfiniteQuery({
    queryKey: inboxKey,
    queryFn: ({ pageParam, signal }) =>
      callWithSession((init) =>
        listMyGymInvitations(
          { limit: PAGE_SIZE, ...(pageParam === null ? {} : { cursor: pageParam }) },
          { ...init, signal },
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    staleTime: 0,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const complete = query.data !== undefined && !query.hasNextPage && !query.isError;
  return {
    query,
    complete,
    // A page without its list (never sent by the contract) adds nothing rather than breaking the view.
    invitations: complete ? query.data.pages.flatMap((page) => page.invitations ?? []) : [],
  };
}

/** Accept and decline from the inbox, by id; every answer reads the lists again. */
export function useAnswerInboxInvitation() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: gymBookingKey });
  const accept = useMutation({
    mutationFn: (id: string) => callWithSession((init) => acceptMyGymInvitation(id, init)),
    retry: false,
    onSettled: refresh,
  });
  const decline = useMutation({
    mutationFn: (id: string) => callWithSession((init) => declineMyGymInvitation(id, init)),
    retry: false,
    onSettled: refresh,
  });
  return { accept, decline };
}
