import { CancelledError, QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { myCoachKey, myCoachesKey } from "@/entities/coach-relationship";
import { incomingInvitationsKey, invitationPreviewKey } from "@/entities/incoming-coach-invitation";
import { completeAuthentication, refresh, signOut } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch } from "@/test/render";

import { useSessionScopedCache } from "./session-cache";

jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const TOKENS = {
  access_token: "sfa_test",
  access_token_expires_at: "2099-01-01T00:00:00Z",
  refresh_token: "sfr_test",
};
const PROFILE_KEY = ["/api/v1/me/fighter-profile"];

/** `/api/me` answers as `userId`; logout succeeds. */
function signedInAs(userId: string) {
  mockFetch(
    jest.fn((url: string) =>
      Promise.resolve(
        new URL(url).pathname === "/api/me"
          ? jsonResponse({ user: { id: userId, created_at: "2026-10-01T10:00:00Z" } })
          : new Response(null, { status: 204 }),
      ),
    ),
  );
}

beforeEach(() => resetSessionForTests());

describe("session-scoped query cache (SF-26, SF-28)", () => {
  it("clears another account's cached server state when the session ends", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(PROFILE_KEY, { display_name: "A" });

    await act(() => signOut());
    await waitFor(() => expect(client.getQueryData(PROFILE_KEY)).toBeUndefined());
  });

  it("clears another account's coaches and coach relationships (SF-59)", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(myCoachesKey("active"), { pages: [{ relationships: [{}] }] });
    client.setQueryData(myCoachKey("rel-1"), { relationship_id: "rel-1" });

    await act(() => signOut());
    await waitFor(() => expect(client.getQueryData(myCoachesKey("active"))).toBeUndefined());
    expect(client.getQueryData(myCoachKey("rel-1"))).toBeUndefined();
  });

  it("clears another account's incoming invitations and previews (SF-76)", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(incomingInvitationsKey, { pages: [{ invitations: [{}] }] });
    client.setQueryData(invitationPreviewKey("inv-1", "en"), { disclosure: {} });

    await act(() => signOut());
    await waitFor(() => expect(client.getQueryData(incomingInvitationsKey)).toBeUndefined());
    expect(client.getQueryData(invitationPreviewKey("inv-1", "en"))).toBeUndefined();
  });

  it("clears it when a sign-in starts a new session, and keeps it across a refresh", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(PROFILE_KEY, { display_name: "A" });

    // A refresh continues the same session: the cache stays.
    mockFetch(
      jest.fn(() =>
        Promise.resolve(
          jsonResponse({ ...TOKENS, access_token: "sfa_rotated", refresh_token: "sfr_rotated" }),
        ),
      ),
    );
    await act(() => refresh());
    expect(client.getQueryData(PROFILE_KEY)).toEqual({ display_name: "A" });

    // Any sign-in is a new session, whoever it turns out to be (SF-28): cleared
    // synchronously, before the new viewer is even known.
    signedInAs("user-b");
    await act(() => completeAuthentication(TOKENS));
    expect(client.getQueryData(PROFILE_KEY)).toBeUndefined();
  });

  it("drops a late answer for the previous user instead of showing it to the next (SF-41)", async () => {
    // No garbage-collection timer: nothing outlives the test.
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));

    let answerForA: (value: unknown) => void = () => {};
    const key = ["/api/v1/me/first-run"];
    const forA = client
      .fetchQuery({
        queryKey: key,
        queryFn: () => new Promise((resolve) => (answerForA = resolve)),
      })
      .then(
        () => "stored",
        (error: unknown) => error,
      );

    signedInAs("user-b");
    await act(() => completeAuthentication(TOKENS));
    // User A's request is cancelled with the cache; its answer has nowhere to land.
    expect(await forA).toBeInstanceOf(CancelledError);
    expect(client.getQueryCache().find({ queryKey: key })).toBeUndefined();

    await act(async () => answerForA({ experiences: [{ status: "completed" }] }));
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
