import type { Href } from "expo-router";

import { callWithSession } from "@/entities/session";
import { resolveMyEntry } from "@/shared/api/generated/endpoints/entry/entry";
import type {
  EntryResponseEntry,
  EntryResponseEntryDestination,
  ResolveMyEntryParams,
} from "@/shared/api/generated/model";
import { continuationQuery, type Continuation } from "@/shared/routes/continuation";
import {
  matchMobileRoute,
  mobileGuards,
  mobileRoute,
  routeHref,
  sanitizeReturnTo,
  type MobileRouteId,
} from "@/shared/routes/routes";

/**
 * Application entry (SF-45; simplefit-api ADR 0017), the same contract as
 * the web client's. Where an authenticated user goes is decided by the
 * backend (`GET /api/v1/me/entry`) from current state: account registration,
 * then the explicit intent, then role state. This module only maps the
 * semantic destination to a registry route and applies the client-side
 * `returnTo` path policy; it never re-derives registration, onboarding or
 * capability state.
 */
export type Entry = EntryResponseEntry;

/**
 * The canonical mobile route of a semantic destination
 * (`guards.entryDestinations`). A destination without a mobile surface (the
 * sponsor application) uses `guards.defaultDestinationFallback`
 * (`/workspaces`, where sponsors continue on the web, D-MOBILE-SPONSOR-ADMIN).
 */
export function destinationRoute(destination: EntryResponseEntryDestination): MobileRouteId {
  return mobileGuards.entryDestinations[destination] ?? mobileGuards.defaultDestinationFallback;
}

/**
 * A safe `returnTo` the user can open now: not the entry itself and not
 * behind a capability the backend does not report. Capabilities are a
 * routing projection; the API still authorizes every request.
 */
function usableReturnTo(returnTo: string | undefined, entry: Entry): string | undefined {
  const safe = sanitizeReturnTo(returnTo);
  if (safe === undefined) return undefined;
  const route = matchMobileRoute(safe.split("?")[0] ?? safe);
  if (route === undefined || route.id === mobileGuards.entry) return undefined;
  const held: readonly string[] = entry.capabilities;
  if (route.capability !== null && !held.includes(route.capability)) return undefined;
  return safe;
}

/**
 * The href for a resolved entry and the continuation the user carries:
 *
 * 1. A mandatory destination (account registration, unfinished Fighter
 *    onboarding) always wins.
 * 2. An explicit intent leads to its journey, unless that journey is already
 *    complete (`fighter_home`).
 * 3. Otherwise a usable `returnTo` wins over the derived destination.
 * 4. Otherwise the destination.
 *
 * Onboarding routes keep the continuation in their params, so it is resolved
 * again once the step completes.
 */
export function entryHref(entry: Entry, continuation: Continuation = {}): Href {
  const target = destinationRoute(entry.destination);
  const intentDriven = continuation.intent !== undefined && entry.destination !== "fighter_home";

  if (!entry.mandatory && !intentDriven) {
    const returnTo = usableReturnTo(continuation.returnTo, entry);
    if (returnTo !== undefined) return returnTo as Href;
  }

  const carries = mobileRoute(target).phase === "ONBOARDING";
  return routeHref(target, {}, carries ? continuationQuery(continuation) : {});
}

/** The resolver request for a continuation: only its validated intent is sent. */
export function entryParams(continuation: Continuation): ResolveMyEntryParams | undefined {
  return continuation.intent === undefined ? undefined : { intent: continuation.intent };
}

/** Resolves the entry of the signed-in user (refreshing the session once on 401). */
export async function fetchEntry(continuation: Continuation, signal?: AbortSignal): Promise<Entry> {
  const params = entryParams(continuation);
  const { entry } = await callWithSession((init) => resolveMyEntry(params, { ...init, signal }));
  return entry;
}
