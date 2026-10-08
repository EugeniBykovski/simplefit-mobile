import type { Href } from "expo-router";

import { ResolveMyEntryIntent } from "@/shared/api/generated/model";

import { mobileGuards, routeHref, sanitizeReturnTo, type MobileRouteId } from "./routes";

/**
 * The navigation continuation the auth and entry screens carry (SF-45), the
 * same contract as the web client's:
 *
 * - `returnTo`: the screen that sent the user to sign-in (SF-24 policy, see
 *   `sanitizeReturnTo`).
 * - `intent`: the journey the user explicitly tried to enter (an approved
 *   call to action or deep link such as `/signup?intent=fighter`).
 *   Navigation only: never stored, never a role, never a capability. Its
 *   allow-list is the backend's (`resolveMyEntry`'s `intent` enum, generated
 *   from OpenAPI).
 *
 * Both live only in route params: when the process restarts without them,
 * the backend's role selection is the safe fallback. Every value is
 * re-validated wherever it is read; anything not allowed is dropped.
 */
export type EntryIntent = ResolveMyEntryIntent;

export type Continuation = { returnTo?: string; intent?: EntryIntent };

const INTENTS: ReadonlySet<string> = new Set(Object.values(ResolveMyEntryIntent));

/** An allowed intent, or `undefined`. Exact match only: no case folding or trimming. */
export function parseIntent(value: unknown): EntryIntent | undefined {
  return typeof value === "string" && INTENTS.has(value) ? (value as EntryIntent) : undefined;
}

/** Route params as Expo Router gives them; a repeated parameter is an array and is rejected. */
type RouteParams = Record<string, string | string[] | undefined>;

/** The valid continuation of a screen's route params. */
export function continuationOf(params: RouteParams): Continuation {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? undefined : value;
  const returnTo = sanitizeReturnTo(single(params[mobileGuards.returnToParam]));
  const intent = parseIntent(single(params[mobileGuards.intentParam]));
  return {
    ...(returnTo === undefined ? {} : { returnTo }),
    ...(intent === undefined ? {} : { intent }),
  };
}

/** The query parameters of a continuation, re-validated. */
export function continuationQuery(continuation: Continuation = {}): Record<string, string> {
  const returnTo = sanitizeReturnTo(continuation.returnTo);
  const intent = parseIntent(continuation.intent);
  return {
    ...(returnTo === undefined ? {} : { [mobileGuards.returnToParam]: returnTo }),
    ...(intent === undefined ? {} : { [mobileGuards.intentParam]: intent }),
  };
}

/** The href of a route that carries the valid continuation along. */
export function withContinuation(id: MobileRouteId, continuation: Continuation = {}): Href {
  return routeHref(id, {}, continuationQuery(continuation));
}
