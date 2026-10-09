import { CancelledError, QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { completeAuthentication, signOut } from "@/entities/session";
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

describe("session-scoped query cache (SF-26)", () => {
  it("clears another account's cached server state when the session ends", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(PROFILE_KEY, { display_name: "A" });

    await act(() => signOut());
    await waitFor(() => expect(client.getQueryData(PROFILE_KEY)).toBeUndefined());
  });

  it("clears it when a different user signs in, and keeps it for the same user", async () => {
    const client = new QueryClient();
    signedInAs("user-a");
    await completeAuthentication(TOKENS);
    await renderHook(() => useSessionScopedCache(client));
    client.setQueryData(PROFILE_KEY, { display_name: "A" });

    // The same user again (a refreshed session) keeps the cache.
    await act(() => completeAuthentication(TOKENS));
    expect(client.getQueryData(PROFILE_KEY)).toEqual({ display_name: "A" });

    signedInAs("user-b");
    await act(() => completeAuthentication(TOKENS));
    await waitFor(() => expect(client.getQueryData(PROFILE_KEY)).toBeUndefined());
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
