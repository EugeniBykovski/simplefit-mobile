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

/**
 * How a session that existed in this launch ended (SF-28): `signed-out` by
 * the user, `expired` when the API rejected its credentials. Unset when there
 * never was a session in this launch.
 */
export type SessionEnd = "signed-out" | "expired";

export type Session = {
  status: SessionStatus;
  /** Set while `authenticated`. */
  viewer?: Viewer;
  /** Why the session is `unavailable` (network or server failure). */
  error?: unknown;
  /** Set while `anonymous` after a session ended in this launch. */
  ended?: SessionEnd;
};

type RefreshOutcome = "refreshed" | "rejected" | "unavailable" | "superseded";
type Credentials = { accessToken: string; expiresAt: number };

/** Whether `signOut` reached the API (`revoked`) or only cleared this device (`local`). */
export type SignOutOutcome = "revoked" | "local";

const REFRESH_TOKEN_KEY = "simplefit.session.refresh_token";
// Refresh shortly before expiry rather than sending a token about to lapse.
const EXPIRY_MARGIN_MS = 30_000;

let snapshot: Session = { status: "loading" };
let credentials: Credentials | undefined;
// Bumped whenever the signed-in identity may change (sign-in, sign-out,
// expiry): work started under an older epoch belongs to another session.
let epoch = 0;
let refreshing: Promise<RefreshOutcome> | undefined;
let restoring: Promise<SessionStatus> | undefined;
let refreshFailure: unknown;
const listeners = new Set<() => void>();
const boundaryListeners = new Set<() => void>();
// SecureStore operations run one after another, in the order they were asked
// for: a sign-out's deletion always lands before the next sign-in's write.
let secureQueue: Promise<unknown> = Promise.resolve();

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const run = secureQueue.then(operation, operation);
  secureQueue = run.catch(() => undefined);
  return run;
}

function publish(next: Session) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/**
 * Registers `listener` to run, synchronously, whenever the signed-in identity
 * changes or ends (SF-28): before the new state is published, so user-scoped
 * client state (the query cache) is gone before anything renders for the
 * next user. Returns the unsubscribe function.
 */
export function onSessionBoundary(listener: () => void): () => void {
  boundaryListeners.add(listener);
  return () => boundaryListeners.delete(listener);
}

function crossBoundary() {
  epoch += 1;
  for (const listener of boundaryListeners) listener();
}

/** The credentials when they are not about to expire. */
const freshCredentials = (): Credentials | undefined =>
  credentials !== undefined && credentials.expiresAt - EXPIRY_MARGIN_MS > Date.now()
    ? credentials
    : undefined;

const isRejection = (error: unknown) => isApiError(error) && error.status === 401;

type Tokens = Pick<SessionTokens, "access_token" | "access_token_expires_at" | "refresh_token">;

/**
 * Stores new credentials of the session of `owner`. Returns false, writing
 * nothing, when that session ended or changed meanwhile (SecureStore writes
 * are asynchronous): a late rotation never replaces the next user's token.
 */
async function adopt(tokens: Tokens, owner: number): Promise<boolean> {
  if (tokens.refresh_token === undefined) {
    throw new Error("A mobile session needs the body-transport refresh token");
  }
  const refreshToken = tokens.refresh_token;
  const stored = await serial(async () => {
    // Checked when the write's turn comes, after any deletion queued before it.
    if (epoch !== owner) return false;
    await setSecureItem(REFRESH_TOKEN_KEY, refreshToken);
    return true;
  });
  if (!stored || epoch !== owner) return false;
  credentials = {
    accessToken: tokens.access_token,
    expiresAt: Date.parse(tokens.access_token_expires_at),
  };
  return true;
}

/**
 * Ends the session: deletes the stored refresh token and forgets the access
 * token. `reason` says how a session that existed ended; a restore that finds
 * no valid session has none.
 */
async function end(reason?: SessionEnd) {
  const ended = reason === "expired" && snapshot.status !== "authenticated" ? undefined : reason;
  crossBoundary();
  credentials = undefined;
  // Anonymous at once: nothing starts a refresh with the token being deleted.
  publish(ended === undefined ? { status: "anonymous" } : { status: "anonymous", ended });
  await serial(() => deleteSecureItem(REFRESH_TOKEN_KEY));
}

async function rotate(): Promise<RefreshOutcome> {
  const owner = epoch;
  const refreshToken = await serial(() => getSecureItem(REFRESH_TOKEN_KEY));
  if (epoch !== owner) return "superseded";
  if (refreshToken === null) {
    credentials = undefined;
    publish({ status: "anonymous" });
    return "rejected";
  }

  try {
    const tokens = await refreshSession({ refresh_token: refreshToken });
    return (await adopt(tokens, owner)) ? "refreshed" : "superseded";
  } catch (error) {
    // The session ended or changed meanwhile: this answer belongs to nobody.
    if (epoch !== owner) return "superseded";
    if (isRejection(error)) {
      await end("expired");
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
 * share one request (a refresh token is single use). Resolves `superseded`
 * when the session ended or changed while it ran: its result is dropped.
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

/**
 * Thrown by `callWithSession` when the session ended or another user signed
 * in while the call ran (SF-28): its response belongs to the previous
 * session and is discarded, never handed to the caller.
 */
export class SessionChangedError extends Error {
  override readonly name = "SessionChangedError";
  constructor() {
    super("The session changed while the request ran");
  }
}

const unauthenticated = () =>
  new ApiError("http", 401, "unauthorized", "No active session", {}, null);

const bearer = (accessToken: string): RequestInit => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

function assertEpoch(owner: number) {
  if (epoch !== owner) throw new SessionChangedError();
}

async function accessToken(owner: number): Promise<string> {
  const current = freshCredentials();
  if (current !== undefined) return current.accessToken;
  if (snapshot.status === "anonymous") throw unauthenticated();
  const outcome = await refresh();
  // This session's own rejection is the canonical 401, even though ending it
  // started a new epoch; only another session's change is SessionChangedError.
  if (outcome === "rejected") throw unauthenticated();
  if (outcome === "superseded") throw new SessionChangedError();
  assertEpoch(owner);
  if (outcome === "unavailable") {
    throw new SessionUnavailableError("Session refresh unavailable", { cause: refreshFailure });
  }
  const next = freshCredentials();
  if (next === undefined) throw unauthenticated();
  return next.accessToken;
}

/**
 * Calls an authenticated endpoint with the access token. On 401 the session
 * is refreshed once — concurrent 401s share that one refresh — and the call
 * retried once with the new token; a second 401 ends the session. A 401 is
 * answered before any business logic runs (the API's authentication plug), so
 * the retry never repeats an operation. A 403, a server failure or no network
 * never refreshes and never ends the session. A response that arrives after
 * the session ended or changed is discarded (`SessionChangedError`).
 */
export async function callWithSession<T>(call: (init: RequestInit) => Promise<T>): Promise<T> {
  const owner = epoch;
  const used = await accessToken(owner);
  try {
    const result = await call(bearer(used));
    assertEpoch(owner);
    return result;
  } catch (error) {
    assertEpoch(owner);
    if (!isRejection(error)) throw error;
  }

  // Take the newer token when a concurrent refresh already replaced the one used.
  const current = freshCredentials();
  let retryWith: string | undefined;
  if (current !== undefined && current.accessToken !== used) retryWith = current.accessToken;
  else {
    const outcome = await refresh();
    if (outcome === "superseded") throw new SessionChangedError();
    if (outcome !== "rejected") assertEpoch(owner);
    if (outcome === "refreshed") retryWith = freshCredentials()?.accessToken;
  }
  if (retryWith === undefined) throw unauthenticated();

  try {
    const result = await call(bearer(retryWith));
    assertEpoch(owner);
    return result;
  } catch (error) {
    assertEpoch(owner);
    if (isRejection(error)) await end("expired");
    throw error;
  }
}

async function loadViewer(): Promise<SessionStatus> {
  const owner = epoch;
  try {
    const { user } = await callWithSession((init) => getCurrentUser(init));
    if (epoch === owner) publish({ status: "authenticated", viewer: user });
  } catch (error) {
    if (error instanceof SessionChangedError || epoch !== owner) return snapshot.status;
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
 * Retries a restore that could not confirm the session (no network or the
 * API failed), for example when the app returns to the foreground. A session
 * that is signed in or signed out is left alone.
 */
export function retryUnavailableSession(): void {
  if (snapshot.status === "unavailable") void restoreSession();
}

/**
 * The one pipeline every sign-in method ends in (Google, Apple, email code):
 * starts a new identity epoch (nothing of a previous session survives),
 * stores the refresh token, keeps the access token in memory and resolves the
 * viewer. Navigation is not decided here: the guest-only gate sends the now
 * authenticated user to the application entry.
 */
export async function completeAuthentication(tokens: Tokens): Promise<SessionStatus> {
  crossBoundary();
  await adopt(tokens, epoch);
  return loadViewer();
}

/**
 * Signs this device out (current device only, ADR 0010): the session ends at
 * once — credentials forgotten, the stored refresh token deleted — then the
 * API is asked to revoke it with the credentials it had. Resolves `revoked`
 * when the API confirmed it and `local` when it could not be reached: the
 * device no longer holds any credential, and the server session expires on
 * its own (nothing is queued to retry later). It never claims a revocation
 * the API did not confirm. Google sign-out stays the caller's (provider
 * sign-out is not SimpleFit sign-out).
 */
export async function signOut(): Promise<SignOutOutcome> {
  const refreshToken = await serial(() => getSecureItem(REFRESH_TOKEN_KEY));
  const accessToken = credentials?.accessToken;
  await end("signed-out");

  try {
    await logout(
      refreshToken === null ? undefined : { refresh_token: refreshToken },
      accessToken === undefined ? {} : { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return "revoked";
  } catch {
    return "local";
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
  // Never back to 0: work still pending from before the reset must stay stale.
  epoch += 1;
  boundaryListeners.clear();
  secureQueue = Promise.resolve();
  publish({ status: "loading" });
}
