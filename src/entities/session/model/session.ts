import { useEffect, useSyncExternalStore } from "react";

import { logout, refreshSession } from "@/shared/api/generated/endpoints/auth/auth";
import type { SessionTokens } from "@/shared/api/generated/model";
import { isApiError } from "@/shared/api/http/api-error";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";

/**
 * The app's SimpleFit session (SF-22; simplefit-api ADR 0010, body transport).
 *
 * - The **refresh token** is persisted only in SecureStore (Keychain /
 *   Keystore, this device only), never in AsyncStorage. It rotates on every
 *   refresh, so the new one replaces the old one immediately.
 * - The **access token** lives only in memory; a restart restores the session
 *   from the refresh token.
 * - Without a network the stored refresh token is kept, so a later launch can
 *   restore the session; only a rejected (401) token is deleted.
 */
export type SessionStatus = "loading" | "authenticated" | "anonymous";

type State = { status: "loading" | "anonymous" } | { status: "authenticated"; accessToken: string };

const REFRESH_TOKEN_KEY = "simplefit.session.refresh_token";

let state: State = { status: "loading" };
let refreshing: Promise<boolean> | undefined;
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getStatus = (): SessionStatus => state.status;

/** Starts a session from fresh body-transport credentials (sign-in or refresh). */
export async function startSession(
  tokens: Pick<SessionTokens, "access_token" | "refresh_token">,
): Promise<void> {
  if (tokens.refresh_token === undefined) {
    throw new Error("A mobile session needs the body-transport refresh token");
  }
  await setSecureItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  setState({ status: "authenticated", accessToken: tokens.access_token });
}

async function rotate(): Promise<boolean> {
  const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
  if (refreshToken === null) {
    setState({ status: "anonymous" });
    return false;
  }

  try {
    await startSession(await refreshSession({ refresh_token: refreshToken }));
    return true;
  } catch (error) {
    if (isApiError(error) && error.status === 401) await deleteSecureItem(REFRESH_TOKEN_KEY);
    setState({ status: "anonymous" });
    return false;
  }
}

/**
 * Exchanges the stored refresh token for a new session. Concurrent callers
 * share one request (a refresh token is single use). Resolves whether a
 * session is active afterwards.
 */
export function refresh(): Promise<boolean> {
  refreshing ??= rotate().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

/** Restores the session from SecureStore once per app launch. */
export function restoreSession(): Promise<boolean> {
  if (state.status !== "loading") return Promise.resolve(state.status === "authenticated");
  return refresh();
}

/**
 * Revokes the session on the API (access and refresh token) and always
 * clears it from SecureStore and memory, even when the request fails.
 */
export async function signOut(): Promise<void> {
  const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
  const accessToken = state.status === "authenticated" ? state.accessToken : undefined;

  try {
    await logout(
      refreshToken === null ? undefined : { refresh_token: refreshToken },
      accessToken === undefined ? {} : { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    // Nothing to undo: the credentials are deleted locally below.
  } finally {
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    setState({ status: "anonymous" });
  }
}

/** The session status; restores the session on first use. */
export function useSessionStatus(): SessionStatus {
  const status = useSyncExternalStore(subscribe, getStatus, getStatus);

  useEffect(() => {
    void restoreSession();
  }, []);

  return status;
}

/** Test seam: back to the state of a fresh launch. */
export function resetSessionForTests(): void {
  refreshing = undefined;
  setState({ status: "loading" });
}
