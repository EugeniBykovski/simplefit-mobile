import { publicEnv } from "@/shared/config/env";

import { ApiError } from "./api-error";

/** Requests without a response after this long fail with ApiError("timeout"). */
export const DEFAULT_TIMEOUT_MS = 15_000;

export type ApiRequestInit = RequestInit & {
  /** Overrides DEFAULT_TIMEOUT_MS for this request. */
  timeoutMs?: number;
};

/**
 * The single HTTP transport of the app, used by the Orval-generated client
 * (configured as its mutator in orval.config.ts). Uses React Native's fetch.
 *
 * - Resolves paths against EXPO_PUBLIC_API_URL; JSON in and out.
 * - Resolves with the parsed body for 2xx responses.
 * - Throws ApiError for HTTP errors, network failures and timeouts.
 * - Cancellation: the caller's `signal` (TanStack Query passes one) aborts the
 *   request; such aborts are rethrown unchanged so Query treats them as
 *   cancellations, not failures.
 *
 * Extension points (implemented by their tickets, not before):
 * - Authentication: add the `Authorization` header in `buildHeaders`, reading
 *   the token from @/shared/storage secure storage.
 * - Token refresh: handle `status === 401` before throwing (refresh once, retry).
 * - Correlation: send a client request id header alongside `x-request-id`.
 *
 * No business logic belongs here.
 */
export async function apiFetch<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(TIMEOUT), timeoutMs);
  const forwardAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) forwardAbort();
  else callerSignal?.addEventListener("abort", forwardAbort);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: buildHeaders(init),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.reason === TIMEOUT) throw ApiError.timeout(timeoutMs);
    if (callerSignal?.aborted) throw error;
    throw ApiError.network(error);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw ApiError.fromResponse(response.status, body, response.headers.get("x-request-id"));
  }
  return body as T;
}

export function apiUrl(path: string): string {
  return `${publicEnv.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

const TIMEOUT = Symbol("timeout");

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (text === "") return undefined;

  const isJson = response.headers.get("content-type")?.includes("json") ?? false;
  if (!isJson) return text;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Error type Orval assigns to generated hooks and query options: the transport
 * always throws ApiError (the documented error body is carried inside it).
 */
export type ErrorType<_ErrorBody> = ApiError;

/** Request body type Orval uses for generated request functions. */
export type BodyType<BodyData> = BodyData;
