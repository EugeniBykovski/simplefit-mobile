import { useEffect, useSyncExternalStore } from "react";

import { getCurrentUser, logout, refreshSession } from "@/shared/api/generated/endpoints/auth/auth";
import type { CurrentUserResponseUser, SessionTokens } from "@/shared/api/generated/model";
import { ApiError, isApiError } from "@/shared/api/http/api-error";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";

/**
 * The app's SimpleFit session (SF-22, SF-24; simplefit-api ADR 0010, body
 * transport).
 *
 * - The **refresh token** is persisted only in SecureStore (Keychain /
 *   Keystore, this device only), never in AsyncStorage. It rotates on every
 *   refresh (single use, no grace period), so refreshes are coalesced: every
 *   concurrent caller shares one request.
 * - The **access token** lives only in memory; a restart restores the session
 *   from the refresh token.
 * - A session is `authenticated` once `GET /api/me` resolved the viewer. Only
 *   a rejected credential (401) ends it and deletes the stored token. Without
 *   a network, or when the API fails, the status is `unavailable`: the token
 *   is kept and the restore can be retried.
 */
export type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

/** The signed-in user as `GET /api/me` returns it: an id, never a role or workspace. */
export type Viewer = CurrentUserResponseUser;

export type Session = {
  status: SessionStatus;
  /** Set while `authenticated`. */
  viewer?: Viewer;
  /** Why the session is `unavailable` (network or server failure). */
  error?: unknown;
};

type RefreshOutcome = "refreshed" | "rejected" | "unavailable";
type Credentials = { accessToken: string; expiresAt: number };

const REFRESH_TOKEN_KEY = "simplefit.session.refresh_token";
// Refresh shortly before expiry rather than sending a token about to lapse.
const EXPIRY_MARGIN_MS = 30_000;

let snapshot: Session = { status: "loading" };
let credentials: Credentials | undefined;
let refreshing: Promise<RefreshOutcome> | undefined;
let restoring: Promise<SessionStatus> | undefined;
let refreshFailure: unknown;
const listeners = new Set<() => void>();

function publish(next: Session) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** The credentials when they are not about to expire. */
const freshCredentials = (): Credentials | undefined =>
  credentials !== undefined && credentials.expiresAt - EXPIRY_MARGIN_MS > Date.now()
    ? credentials
    : undefined;

const isRejection = (error: unknown) => isApiError(error) && error.status === 401;

async function adopt(
  tokens: Pick<SessionTokens, "access_token" | "access_token_expires_at" | "refresh_token">,
) {
  if (tokens.refresh_token === undefined) {
    throw new Error("A mobile session needs the body-transport refresh token");
  }
  await setSecureItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  credentials = {
    accessToken: tokens.access_token,
    expiresAt: Date.parse(tokens.access_token_expires_at),
  };
}

/** Ends the session: deletes the stored refresh token and forgets the access token. */
async function end() {
  credentials = undefined;
  await deleteSecureItem(REFRESH_TOKEN_KEY);
  publish({ status: "anonymous" });
}

async function rotate(): Promise<RefreshOutcome> {
  const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
  if (refreshToken === null) {
    credentials = undefined;
    publish({ status: "anonymous" });
    return "rejected";
  }

  try {
    await adopt(await refreshSession({ refresh_token: refreshToken }));
    return "refreshed";
  } catch (error) {
    if (isRejection(error)) {
      await end();
      return "rejected";
    }
    // Offline or the API failed: keep the stored token for a later attempt.
    refreshFailure = error;
    if (snapshot.status !== "authenticated") publish({ status: "unavailable", error });
    return "unavailable";
  }
}

/**
 * Exchanges the stored refresh token for new credentials. Concurrent callers
 * share one request (a refresh token is single use).
 */
export function refresh(): Promise<RefreshOutcome> {
  refreshing ??= rotate().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

/** Thrown by `callWithSession` when no credential could be obtained for a reason other than rejection. */
export class SessionUnavailableError extends Error {
  override readonly name = "SessionUnavailableError";
}

const unauthenticated = () =>
  new ApiError("http", 401, "unauthorized", "No active session", {}, null);

const bearer = (accessToken: string): RequestInit => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

async function accessToken(): Promise<string> {
  const current = freshCredentials();
  if (current !== undefined) return current.accessToken;
  if (snapshot.status === "anonymous") throw unauthenticated();
  const outcome = await refresh();
  if (outcome === "unavailable") {
    throw new SessionUnavailableError("Session refresh unavailable", { cause: refreshFailure });
  }
  const next = freshCredentials();
  if (outcome === "rejected" || next === undefined) throw unauthenticated();
  return next.accessToken;
}

/**
 * Calls an authenticated endpoint with the access token. On 401 the session
 * is refreshed once — concurrent 401s share that one refresh — and the call
 * retried once with the new token; a second 401 ends the session. A network
 * or server failure never ends it.
 */
export async function callWithSession<T>(call: (init: RequestInit) => Promise<T>): Promise<T> {
  const used = await accessToken();
  try {
    return await call(bearer(used));
  } catch (error) {
    if (!isRejection(error)) throw error;
  }

  // Take the newer token when a concurrent refresh already replaced the one used.
  const current = freshCredentials();
  const retryWith =
    current !== undefined && current.accessToken !== used
      ? current.accessToken
      : (await refresh()) === "refreshed"
        ? freshCredentials()?.accessToken
        : undefined;
  if (retryWith === undefined) throw unauthenticated();

  try {
    return await call(bearer(retryWith));
  } catch (error) {
    if (isRejection(error)) await end();
    throw error;
  }
}

async function loadViewer(): Promise<SessionStatus> {
  try {
    const { user } = await callWithSession((init) => getCurrentUser(init));
    publish({ status: "authenticated", viewer: user });
  } catch (error) {
    if (isRejection(error)) {
      if (snapshot.status !== "anonymous") await end();
    } else {
      const cause = error instanceof SessionUnavailableError ? error.cause : error;
      publish({ status: "unavailable", error: cause });
    }
  }
  return snapshot.status;
}

/**
 * Restores the session once per launch: refresh from SecureStore, then
 * `GET /api/me`. After `unavailable` it can be called again to retry.
 */
export function restoreSession(): Promise<SessionStatus> {
  if (snapshot.status === "authenticated" || snapshot.status === "anonymous") {
    return Promise.resolve(snapshot.status);
  }
  restoring ??= (async () => {
    if (freshCredentials() === undefined) {
      const outcome = await refresh();
      if (outcome !== "refreshed") return snapshot.status;
    }
    return loadViewer();
  })().finally(() => {
    restoring = undefined;
  });
  return restoring;
}

/**
 * The one pipeline every sign-in method ends in (Google, Apple, email code):
 * stores the refresh token, keeps the access token in memory and resolves the
 * viewer. Navigation is not decided here: the guest-only gate sends the now
 * authenticated user to the application entry.
 */
export async function completeAuthentication(
  tokens: Pick<SessionTokens, "access_token" | "access_token_expires_at" | "refresh_token">,
): Promise<SessionStatus> {
  await adopt(tokens);
  return loadViewer();
}

/**
 * Revokes the session on the API (access and refresh token) and always
 * clears it from SecureStore and memory, even when the request fails.
 */
export async function signOut(): Promise<void> {
  const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
  const accessToken = credentials?.accessToken;

  try {
    await logout(
      refreshToken === null ? undefined : { refresh_token: refreshToken },
      accessToken === undefined ? {} : { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    // Nothing to undo: the credentials are deleted locally below.
  } finally {
    await end();
  }
}

/** The session; restores it on first use. */
export function useSession(): Session {
  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void restoreSession();
  }, []);

  return session;
}

/** The session status; restores the session on first use. */
export function useSessionStatus(): SessionStatus {
  return useSession().status;
}

/** Test seam: back to the state of a fresh launch. */
export function resetSessionForTests(): void {
  refreshing = undefined;
  restoring = undefined;
  credentials = undefined;
  refreshFailure = undefined;
  publish({ status: "loading" });
}
