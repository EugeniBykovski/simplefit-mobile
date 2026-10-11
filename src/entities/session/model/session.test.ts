import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getCurrentUser } from "@/shared/api/generated/endpoints/auth/auth";
import { isApiError } from "@/shared/api/http/api-error";
import { getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch } from "@/test/render";

import {
  callWithSession,
  completeAuthentication,
  onSessionBoundary,
  refresh,
  resetSessionForTests,
  restoreSession,
  retryUnavailableSession,
  SessionChangedError,
  signOut,
  useSession,
  useSessionStatus,
} from "./session";

const KEY = "simplefit.session.refresh_token";
const OLD = `sfr_${"a".repeat(43)}`;
const NEW = `sfr_${"b".repeat(43)}`;
const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

const tokenBody = (refreshToken: string, accessToken = "sfa_access", expiresAt = inAnHour()) => ({
  access_token: accessToken,
  access_token_expires_at: expiresAt,
  refresh_token: refreshToken,
  refresh_token_expires_at: inAnHour(),
  refresh_token_transport: "body",
  token_type: "Bearer",
});
const tokens = (refreshToken: string, accessToken?: string) =>
  jsonResponse(tokenBody(refreshToken, accessToken));
const viewer = () => jsonResponse({ user: VIEWER });
const unauthorized = () =>
  jsonResponse(
    { error: { code: "unauthorized", message: "Authentication is required", details: {} } },
    { status: 401 },
  );
const serverError = () =>
  jsonResponse(
    { error: { code: "service_unavailable", message: "Try later", details: {} } },
    { status: 503 },
  );
const offline = () => Promise.reject(new TypeError("Network request failed"));

/** AsyncStorage keys (the storage boundary forbids importing it directly). */
const asyncStorageKeys = (): Promise<readonly string[]> =>
  jest
    .requireMock<{ getAllKeys(): Promise<readonly string[]> }>(
      "@react-native-async-storage/async-storage",
    )
    .getAllKeys();

type Call = [string, RequestInit];
const calls = (fetchMock: jest.Mock) => fetchMock.mock.calls as Call[];
const paths = (fetchMock: jest.Mock) =>
  calls(fetchMock).map(([url]) => url.replace("http://api.test", ""));
const header = ([, init]: Call, name: string) => new Headers(init.headers).get(name);

/** Answers by path; each path's answers are used in order, the last one repeats. */
function api(routes: Record<string, (() => Response | Promise<Response>)[]>) {
  const seen = new Map<string, number>();
  return mockFetch(
    jest.fn((url: string) => {
      const path = new URL(url).pathname;
      const answers = routes[path];
      if (!answers) throw new Error(`unexpected request ${path}`);
      const index = seen.get(path) ?? 0;
      seen.set(path, index + 1);
      return Promise.resolve(answers[Math.min(index, answers.length - 1)]!());
    }),
  );
}

describe("session", () => {
  beforeEach(() => {
    resetSessionForTests();
  });

  describe("restore", () => {
    it("is anonymous at launch without a stored refresh token, without calling the API", async () => {
      const fetchMock = mockFetch(jest.fn());

      await expect(restoreSession()).resolves.toBe("anonymous");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rotates the refresh token in SecureStore, then resolves the viewer", async () => {
      await setSecureItem(KEY, OLD);
      const fetchMock = api({
        "/api/auth/session/refresh": [() => tokens(NEW, "sfa_restored")],
        "/api/me": [viewer],
      });
      const { result } = await renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe("authenticated"));
      expect(result.current.viewer).toEqual(VIEWER);
      const [refreshCall, meCall] = calls(fetchMock);
      expect(JSON.parse(String(refreshCall![1].body))).toEqual({ refresh_token: OLD });
      expect(header(meCall!, "authorization")).toBe("Bearer sfa_restored");
      expect(await getSecureItem(KEY)).toBe(NEW);
    });

    it("deletes a rejected refresh token and is anonymous", async () => {
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [unauthorized] });

      await expect(restoreSession()).resolves.toBe("anonymous");
      expect(await getSecureItem(KEY)).toBeNull();
    });

    it.each([
      ["the network fails", offline],
      ["the API is unavailable", serverError],
    ])("is unavailable, not anonymous, and keeps the token when %s", async (_case, failure) => {
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [failure] });
      const { result } = await renderHook(() => useSession());

      await waitFor(() => expect(result.current.status).toBe("unavailable"));
      expect(result.current.error).toBeDefined();
      expect(await getSecureItem(KEY)).toBe(OLD);
    });

    it("can retry an unavailable restore", async () => {
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [offline, () => tokens(NEW)], "/api/me": [viewer] });

      await expect(restoreSession()).resolves.toBe("unavailable");
      await expect(restoreSession()).resolves.toBe("authenticated");
    });

    it("is unavailable when /api/me fails after a good refresh, and retries only /api/me", async () => {
      await setSecureItem(KEY, OLD);
      const fetchMock = api({
        "/api/auth/session/refresh": [() => tokens(NEW)],
        "/api/me": [offline, viewer],
      });

      await expect(restoreSession()).resolves.toBe("unavailable");
      await expect(restoreSession()).resolves.toBe("authenticated");
      expect(paths(fetchMock)).toEqual(["/api/auth/session/refresh", "/api/me", "/api/me"]);
    });

    it("shares one refresh between concurrent callers (refresh tokens are single use)", async () => {
      await setSecureItem(KEY, OLD);
      const fetchMock = api({
        "/api/auth/session/refresh": [() => tokens(NEW)],
        "/api/me": [viewer],
      });

      await Promise.all([refresh(), refresh(), restoreSession()]);

      expect(paths(fetchMock).filter((path) => path.endsWith("/refresh"))).toHaveLength(1);
    });

    it("never writes tokens to AsyncStorage", async () => {
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [() => tokens(NEW)], "/api/me": [viewer] });

      await restoreSession();

      expect(await asyncStorageKeys()).toEqual([]);
    });
  });

  describe("callWithSession", () => {
    async function signedIn(accessToken = "sfa_stale") {
      api({ "/api/me": [viewer] });
      await completeAuthentication(tokenBody(OLD, accessToken));
    }

    it("sends the access token as a bearer token", async () => {
      await signedIn("sfa_current");
      const fetchMock = api({ "/api/me": [viewer] });

      await callWithSession((init) => getCurrentUser(init));

      expect(header(calls(fetchMock)[0]!, "authorization")).toBe("Bearer sfa_current");
    });

    it("makes one coalesced refresh for concurrent 401s and retries each call once", async () => {
      await signedIn();
      const fetchMock = api({
        "/api/me": [unauthorized, unauthorized, unauthorized, viewer],
        "/api/auth/session/refresh": [() => tokens(NEW, "sfa_new")],
      });

      await Promise.all([
        callWithSession((init) => getCurrentUser(init)),
        callWithSession((init) => getCurrentUser(init)),
        callWithSession((init) => getCurrentUser(init)),
      ]);

      expect(paths(fetchMock).filter((path) => path.endsWith("/refresh"))).toHaveLength(1);
      const retries = calls(fetchMock).slice(-3);
      expect(retries.map((call) => header(call, "authorization"))).toEqual([
        "Bearer sfa_new",
        "Bearer sfa_new",
        "Bearer sfa_new",
      ]);
      expect(await getSecureItem(KEY)).toBe(NEW);
    });

    it("ends the session when the retried call is rejected again, without looping", async () => {
      await signedIn();
      const fetchMock = api({
        "/api/me": [unauthorized],
        "/api/auth/session/refresh": [() => tokens(NEW)],
      });
      const { result } = await renderHook(() => useSessionStatus());

      let error: unknown;
      await act(async () => {
        error = await callWithSession((init) => getCurrentUser(init)).catch((e: unknown) => e);
      });

      expect(isApiError(error) && error.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await waitFor(() => expect(result.current).toBe("anonymous"));
      expect(await getSecureItem(KEY)).toBeNull();
    });

    it("keeps the session when the refresh after a 401 fails on the network", async () => {
      await signedIn();
      api({ "/api/me": [unauthorized], "/api/auth/session/refresh": [offline] });
      const { result } = await renderHook(() => useSessionStatus());

      await act(async () => {
        await callWithSession((init) => getCurrentUser(init)).catch(() => undefined);
      });

      expect(result.current).toBe("authenticated");
      expect(await getSecureItem(KEY)).toBe(OLD);
    });

    it("does not call the endpoint without a session", async () => {
      mockFetch(jest.fn());
      await restoreSession();
      const call = jest.fn();

      const error = await callWithSession(call).catch((e: unknown) => e);

      expect(isApiError(error) && error.code).toBe("unauthorized");
      expect(call).not.toHaveBeenCalled();
    });
  });

  describe("sign-out", () => {
    it("signs out with both tokens and clears SecureStore and memory", async () => {
      api({ "/api/me": [viewer] });
      await completeAuthentication(tokenBody(OLD, "sfa_current"));
      const fetchMock = mockFetch(jest.fn().mockResolvedValue(new Response(null, { status: 204 })));
      const { result } = await renderHook(() => useSessionStatus());
      expect(result.current).toBe("authenticated");

      await act(() => signOut());

      const [[url, init]] = calls(fetchMock) as [Call];
      expect(url).toBe("http://api.test/api/auth/logout");
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer sfa_current");
      expect(JSON.parse(String(init.body))).toEqual({ refresh_token: OLD });
      expect(await getSecureItem(KEY)).toBeNull();
      expect(result.current).toBe("anonymous");
    });

    it("clears the session locally even when the logout request fails", async () => {
      api({ "/api/me": [viewer] });
      await completeAuthentication(tokenBody(OLD));
      mockFetch(jest.fn(offline));

      await signOut();

      expect(await getSecureItem(KEY)).toBeNull();
      await expect(restoreSession()).resolves.toBe("anonymous");
    });
  });

  /*
   * SF-28: the lifecycle across identity boundaries. Answers are held back so
   * they arrive after the user signed out or another user signed in.
   */
  describe("session boundaries (SF-28)", () => {
    const B = `sfr_${"c".repeat(43)}`;
    const VIEWER_B = {
      id: "4c5f2b1e-9d0a-4f6e-8a3b-2d7c1e0f9a8b",
      created_at: "2026-10-02T10:00:00Z",
    };
    const viewerB = () => jsonResponse({ user: VIEWER_B });
    const noContent = () => new Response(null, { status: 204 });

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    /** A signs in; A's next call is rejected so it rotates (held back); B answers afterwards. */
    function raceApi(lateRefresh: Promise<Response>) {
      let meCalls = 0;
      return mockFetch(
        jest.fn((url: string) => {
          const path = new URL(url).pathname;
          if (path === "/api/auth/session/refresh") return lateRefresh;
          if (path === "/api/auth/logout") return Promise.resolve(noContent());
          meCalls += 1;
          return Promise.resolve(
            meCalls === 1 ? viewer() : meCalls === 2 ? unauthorized() : viewerB(),
          );
        }),
      );
    }

    it("a late rotation never replaces the next user's refresh token in SecureStore", async () => {
      const lateRefresh = deferred<Response>();
      raceApi(lateRefresh.promise);
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      const pendingA = callWithSession((init) => getCurrentUser(init)).catch(
        (error: unknown) => error,
      );

      await signOut();
      await completeAuthentication(tokenBody(B, "sfa_b"));
      lateRefresh.resolve(tokens(NEW, "sfa_a_rotated"));

      expect(await pendingA).toBeInstanceOf(SessionChangedError);
      expect(await getSecureItem(KEY)).toBe(B);
      const { result } = await renderHook(() => useSession());
      expect(result.current).toEqual({ status: "authenticated", viewer: VIEWER_B });
    });

    it("a late rejection of the previous session never deletes the next user's token", async () => {
      const lateRefresh = deferred<Response>();
      raceApi(lateRefresh.promise);
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      const pendingA = callWithSession((init) => getCurrentUser(init)).catch(
        (error: unknown) => error,
      );

      await signOut();
      await completeAuthentication(tokenBody(B, "sfa_b"));
      lateRefresh.resolve(unauthorized());
      await pendingA;

      expect(await getSecureItem(KEY)).toBe(B);
      const { result } = await renderHook(() => useSessionStatus());
      expect(result.current).toBe("authenticated");
    });

    it("discards the previous user's slow response instead of handing it to the caller", async () => {
      const slow = deferred<Response>();
      mockFetch(
        jest.fn((url: string) => {
          const path = new URL(url).pathname;
          if (path === "/api/auth/logout") return Promise.resolve(noContent());
          if (path === "/api/v1/me/fighter-profile") return slow.promise;
          return Promise.resolve(viewer());
        }),
      );
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      const pending = callWithSession((init) =>
        fetch("http://api.test/api/v1/me/fighter-profile", init).then((response) =>
          response.json(),
        ),
      ).catch((error: unknown) => error);

      await signOut();
      slow.resolve(jsonResponse({ fighter_profile: { status: "completed" } }));

      expect(await pending).toBeInstanceOf(SessionChangedError);
    });

    it("an offline sign-out says it is local, deletes the token and queues nothing", async () => {
      api({ "/api/me": [viewer] });
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      const fetchMock = mockFetch(jest.fn(offline));

      await expect(signOut()).resolves.toBe("local");

      expect(await getSecureItem(KEY)).toBeNull();
      expect(await asyncStorageKeys()).toEqual([]);
      // Nothing retries the logout later with a kept credential.
      const attempts = fetchMock.mock.calls.length;
      await restoreSession();
      expect(fetchMock.mock.calls.length).toBe(attempts);
    });

    it("a confirmed sign-out says the API revoked it", async () => {
      api({ "/api/me": [viewer], "/api/auth/logout": [noContent] });
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      await expect(signOut()).resolves.toBe("revoked");
      const { result } = await renderHook(() => useSession());
      expect(result.current).toEqual({ status: "anonymous", ended: "signed-out" });
    });

    it("marks a session the API rejected as expired, and never one that never existed", async () => {
      api({ "/api/me": [viewer] });
      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      api({ "/api/me": [unauthorized], "/api/auth/session/refresh": [unauthorized] });
      await callWithSession((init) => getCurrentUser(init)).catch(() => undefined);
      const { result } = await renderHook(() => useSession());
      expect(result.current).toEqual({ status: "anonymous", ended: "expired" });

      resetSessionForTests();
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [unauthorized] });
      await restoreSession();
      const { result: launch } = await renderHook(() => useSession());
      expect(launch.current).toEqual({ status: "anonymous" });
    });

    it("runs the boundary listeners on sign-in, sign-out and expiry, not on a refresh", async () => {
      const boundary = jest.fn();
      onSessionBoundary(boundary);
      api({
        "/api/me": [viewer],
        "/api/auth/session/refresh": [() => tokens(NEW, "sfa_rotated")],
        "/api/auth/logout": [noContent],
      });

      await completeAuthentication(tokenBody(OLD, "sfa_a"));
      expect(boundary).toHaveBeenCalledTimes(1);
      await refresh();
      expect(boundary).toHaveBeenCalledTimes(1);
      await signOut();
      expect(boundary).toHaveBeenCalledTimes(2);
    });

    it("retries an unconfirmed restore on request, and leaves other states alone", async () => {
      await setSecureItem(KEY, OLD);
      api({ "/api/auth/session/refresh": [serverError] });
      await restoreSession();
      const fetchMock = api({
        "/api/auth/session/refresh": [() => tokens(NEW, "sfa_back")],
        "/api/me": [viewer],
      });

      retryUnavailableSession();
      const { result } = await renderHook(() => useSessionStatus());
      await waitFor(() => expect(result.current).toBe("authenticated"));

      retryUnavailableSession();
      expect(paths(fetchMock)).toEqual(["/api/auth/session/refresh", "/api/me"]);
    });
  });
});
