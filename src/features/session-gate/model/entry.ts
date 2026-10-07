import type { Href } from "expo-router";

import type { Viewer } from "@/entities/session";
import { mobileGuards, routeHref, sanitizeReturnTo } from "@/shared/routes/routes";

/**
 * Application entry (SF-24), the same rule as the web client's: where an
 * authenticated viewer goes after sign-in, sign-up or a restored session on a
 * guest-only screen. Pure.
 *
 * 1. A valid `returnTo` (see `sanitizeReturnTo`), consumed once: the
 *    destination replaces the auth screen.
 * 2. Otherwise the neutral canonical entry, `/` (`guards.entry`).
 *
 * The API exposes only the viewer's id today, so nothing is inferred about
 * roles, profiles, workspaces, onboarding, consent or account state. Later
 * tickets add viewer-driven branches here once `GET /api/me` carries that
 * state; the sign-in flows do not change.
 */
export function resolveEntry(viewer: Viewer, returnTo: unknown): Href {
  const target = sanitizeReturnTo(Array.isArray(returnTo) ? undefined : returnTo);
  return target === undefined ? routeHref(mobileGuards.entry) : (target as Href);
}
