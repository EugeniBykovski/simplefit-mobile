import type { Href } from "expo-router";

import { mobileCapabilities, mobileGuards, mobileRoutes, mobileShells } from "./mobile-routes";

/**
 * Typed access to the canonical mobile routes (SF-31 registry, generated into
 * ./mobile-routes.ts by `pnpm routes:generate`). Never write a product path by
 * hand; resolve it from its route id here (route-architecture §14).
 */
export type MobileRoute = (typeof mobileRoutes)[number];
export type MobileRouteId = MobileRoute["id"];
export type MobileShell = (typeof mobileShells)[number];
export type MobileShellId = MobileShell["id"];
export type SessionRequirement = MobileRoute["session"];
export type Capability = keyof typeof mobileCapabilities;

const routesById = new Map<string, MobileRoute>(mobileRoutes.map((route) => [route.id, route]));
const shellsById = new Map<string, MobileShell>(mobileShells.map((shell) => [shell.id, shell]));

export function mobileRoute(id: MobileRouteId): MobileRoute {
  const route = routesById.get(id);
  if (!route) throw new Error(`Unknown mobile route ${id}`);
  return route;
}

export function isMobileRouteId(id: string): id is MobileRouteId {
  return routesById.has(id);
}

export function mobileShell(id: MobileShellId): MobileShell {
  const shell = shellsById.get(id);
  if (!shell) throw new Error(`Unknown mobile shell ${id}`);
  return shell;
}

/**
 * The href of a route: named parameters are filled from `params` (each one is
 * required and URL-encoded) and `query` is appended. Deferred routes have no
 * screen and are never linked.
 */
export function routeHref(
  id: MobileRouteId,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): Href {
  const route = mobileRoute(id);
  if (route.status === "DEFERRED") throw new Error(`${id} is deferred and has no screen`);
  const path = route.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") throw new Error(`${id} needs the :${name} parameter`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams(query).toString();
  return (search ? `${path}?${search}` : path) as Href;
}

const segmentsOf = (path: string) => (path === "/" ? [] : path.slice(1).split("/"));

/**
 * The registry route a pathname resolves to, the way Expo Router ranks
 * routes: at the first segment where two candidates differ, a static segment
 * wins over a parameter (`/coach/sessions/:sessionId/roster` before
 * `/coach/:coachId/services/:serviceId`). The catch-all and deferred routes
 * (which have no screen) are never returned.
 */
export function matchMobileRoute(pathname: string): MobileRoute | undefined {
  const target = segmentsOf(pathname.replace(/\/+$/, "") || "/");
  let best: { route: MobileRoute; rank: number[] } | undefined;

  for (const route of mobileRoutes) {
    if (route.nav === "CATCH_ALL" || route.status === "DEFERRED") continue;
    const pattern = segmentsOf(route.path);
    if (pattern.length !== target.length) continue;

    const rank: number[] = [];
    const matches = pattern.every((segment, index) => {
      if (segment.startsWith(":")) {
        rank.push(0);
        return target[index] !== "";
      }
      rank.push(1);
      return segment === target[index];
    });
    if (matches && (!best || outranks(rank, best.rank))) best = { route, rank };
  }
  return best?.route;
}

function outranks(rank: number[], other: number[]): boolean {
  const index = rank.findIndex((value, position) => value !== other[position]);
  return index !== -1 && (rank[index] ?? 0) > (other[index] ?? 0);
}

/**
 * Whether the route is a tab of its own shell's tab bar. Tab routes render
 * inside the shell's tab navigator; every other route is pushed above it.
 */
export function isTabRoute(id: MobileRouteId): boolean {
  const route = mobileRoute(id);
  return mobileShell(route.shell).navItems.some((item) => item.route === id);
}

/**
 * The href of an auth route carrying `returnTo` when it is a valid
 * destination under the SF-24 policy (`sanitizeReturnTo`); otherwise none.
 */
export function withReturnTo(id: MobileRouteId, returnTo: string | undefined): Href {
  const safe = sanitizeReturnTo(returnTo);
  return routeHref(id, {}, safe === undefined ? {} : { [mobileGuards.returnToParam]: safe });
}

/**
 * The sign-in href for a signed-out visitor of `pathname`, carrying the
 * requested path in `returnTo` when it is a valid destination
 * (route-architecture §9).
 */
export function signInHref(pathname: string): Href {
  return withReturnTo(mobileGuards.signIn, pathname);
}

/**
 * The `returnTo` policy (SF-24; route-architecture §9), the same as the web
 * client's. After authentication the user may continue to the screen that
 * sent them to sign-in, but only to a screen sign-in can actually lead to.
 * Anything else is dropped silently and the neutral entry is used instead.
 *
 * Accepted: an in-app path (`/…`, decoded exactly once by the router) of at
 * most 2048 characters that resolves to a canonical registry route which is
 * neither guest-only (no login loop), nor an onboarding or restricted-account
 * route (those are reached from viewer state only), nor the not-found
 * catch-all. Only pathname and query are kept; a hash is discarded. Scheme
 * URLs (`simplefit://…`, `https://…`) are never accepted here: deep links
 * arrive as router paths.
 */
const MAX_LENGTH = 2048;
const SENTINEL_ORIGIN = "https://return-to.invalid";

const NEVER_RETURN_TO: ReadonlySet<MobileRouteId> = new Set<MobileRouteId>([
  mobileGuards.notFound,
  mobileGuards.restrictedAccount.suspended,
  mobileGuards.restrictedAccount.pendingDeletion,
]);

// Backslashes (`/\host` is `//host` to URL parsers), whitespace and control characters.
const UNSAFE = /[\\\s\u0000-\u001f\u007f]/;

export function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value.length > MAX_LENGTH) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || UNSAFE.test(value)) return undefined;

  let url: URL;
  try {
    url = new URL(value, SENTINEL_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== SENTINEL_ORIGIN || url.pathname.startsWith("//")) return undefined;

  const route = matchMobileRoute(url.pathname);
  if (route === undefined || NEVER_RETURN_TO.has(route.id)) return undefined;
  if (route.session === "GUEST_ONLY" || route.phase === "ONBOARDING") return undefined;

  return `${url.pathname}${url.search}`;
}

export { mobileCapabilities, mobileGuards };
