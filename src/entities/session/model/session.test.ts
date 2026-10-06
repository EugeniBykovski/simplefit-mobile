import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch } from "@/test/render";

import {
  refresh,
  resetSessionForTests,
  restoreSession,
  signOut,
  startSession,
  useSessionStatus,
} from "./session";

const KEY = "simplefit.session.refresh_token";
const OLD = `sfr_${"a".repeat(43)}`;
const NEW = `sfr_${"b".repeat(43)}`;

const tokens = (refreshToken: string) =>
  jsonResponse({
    access_token: "sfa_access",
    access_token_expires_at: new Date(Date.now() + 900_000).toISOString(),
    refresh_token: refreshToken,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    refresh_token_transport: "body",
    token_type: "Bearer",
  });

const unauthorized = () =>
  jsonResponse(
    { error: { code: "unauthorized", message: "Authentication is required", details: {} } },
    { status: 401 },
  );

/** AsyncStorage keys (the storage boundary forbids importing it directly). */
const asyncStorageKeys = (): Promise<readonly string[]> =>
  jest
    .requireMock<{ getAllKeys(): Promise<readonly string[]> }>(
      "@react-native-async-storage/async-storage",
    )
    .getAllKeys();

type Call = [string, RequestInit];
const calls = (fetchMock: jest.Mock) => fetchMock.mock.calls as Call[];

describe("session", () => {
  beforeEach(() => {
    resetSessionForTests();
  });

  it("is anonymous at launch without a stored refresh token, without calling the API", async () => {
    const fetchMock = mockFetch(jest.fn());

    await expect(restoreSession()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores the session and stores the rotated refresh token in SecureStore", async () => {
    await setSecureItem(KEY, OLD);
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(tokens(NEW)));

    await expect(restoreSession()).resolves.toBe(true);

    const [[url, init]] = calls(fetchMock) as [Call];
    expect(url).toBe("http://api.test/api/auth/session/refresh");
    expect(JSON.parse(String(init.body))).toEqual({ refresh_token: OLD });
    expect(await getSecureItem(KEY)).toBe(NEW);
  });

  it("shares one refresh between concurrent callers (refresh tokens are single use)", async () => {
    await setSecureItem(KEY, OLD);
    const fetchMock = mockFetch(jest.fn().mockResolvedValue(tokens(NEW)));

    await Promise.all([refresh(), refresh(), restoreSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes a rejected refresh token", async () => {
    await setSecureItem(KEY, OLD);
    mockFetch(jest.fn().mockResolvedValue(unauthorized()));

    await expect(restoreSession()).resolves.toBe(false);
    expect(await getSecureItem(KEY)).toBeNull();
  });

  it("keeps the refresh token when the API cannot be reached", async () => {
    await setSecureItem(KEY, OLD);
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));

    await expect(restoreSession()).resolves.toBe(false);
    expect(await getSecureItem(KEY)).toBe(OLD);
  });

  it("signs out with both tokens and clears SecureStore and memory", async () => {
    await startSession({ access_token: "sfa_current", refresh_token: OLD });
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
    await startSession({ access_token: "sfa_current", refresh_token: OLD });
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));

    await signOut();

    expect(await getSecureItem(KEY)).toBeNull();
    await expect(restoreSession()).resolves.toBe(false);
  });

  it("never writes tokens to AsyncStorage", async () => {
    await setSecureItem(KEY, OLD);
    mockFetch(jest.fn().mockResolvedValue(tokens(NEW)));

    await restoreSession();

    expect(await asyncStorageKeys()).toEqual([]);
  });

  it("reports the status to components", async () => {
    await setSecureItem(KEY, OLD);
    mockFetch(jest.fn().mockResolvedValue(tokens(NEW)));

    const { result } = await renderHook(() => useSessionStatus());

    await waitFor(() => expect(result.current).toBe("authenticated"));
  });
});
