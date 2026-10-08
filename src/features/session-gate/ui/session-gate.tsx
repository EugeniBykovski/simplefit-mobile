import { type Href, Redirect, useGlobalSearchParams, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useSession, type Session } from "@/entities/session";
import { continuationOf, continuationQuery } from "@/shared/routes/continuation";
import {
  matchMobileRoute,
  mobileGuards,
  routeHref,
  signInHref,
  type MobileRoute,
  type MobileShellId,
} from "@/shared/routes/routes";
import { Spinner } from "@/shared/ui/spinner";

/**
 * Session guard of a shell layout (route-architecture §9, rules 2 and 3).
 * It applies the `session` access of the focused registry route when that
 * route belongs to `shell`:
 *
 * - PUBLIC: rendered for everyone;
 * - AUTHENTICATED: waits for the session restore, then sends signed-out
 *   visitors to the sign-in route with `returnTo` (when the screen is a valid
 *   destination);
 * - GUEST_ONLY: sends an authenticated viewer into the application through
 *   the entry `/`, which resolves the destination with the backend (SF-45),
 *   carrying the screen's continuation (`returnTo`, `intent`). This is the
 *   one place authentication navigates, for every method (email code,
 *   Google, Apple); the sign-in methods only complete the session.
 *
 * While the session cannot be confirmed (network or server failure,
 * `unavailable`) a gated screen shows the layout's `unavailable` view, which
 * retries; a transient failure never counts as a sign-out.
 *
 * One shell can mix all three (welcome, consent and invite links share the
 * auth shell), so the rule comes from the route, never from the group or a
 * URL prefix. Routes of other shells pass through: a shell further down the
 * stack never redirects for the screen on top.
 *
 * UX only: capability, phase, active workspace and restricted-account rules
 * are not resolved here (the API exposes no such viewer state yet), and the
 * backend authorizes every request.
 */
export function SessionGate({
  shell,
  pending: pendingView,
  unavailable: unavailableView,
  children,
}: {
  shell: MobileShellId;
  /** What covers the shell while the session is restored (the layouts pass the LD1 launch screen, SF-34). */
  pending?: ReactNode;
  /** What covers a gated screen while the session cannot be confirmed (the layouts pass SessionFailure, SF-24). */
  unavailable?: ReactNode;
  children: ReactNode;
}) {
  const session = useSession();
  const { status } = session;
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const t = useTranslations("auth.session");
  const route = matchMobileRoute(pathname);

  const redirect = redirectFor(route, shell, session, pathname, params);
  const gated = route !== undefined && route.shell === shell && route.session !== "PUBLIC";
  const pending = gated && status === "loading";
  const unavailable = gated && status === "unavailable" && unavailableView !== undefined;

  // The shell's navigator stays mounted while the session is checked:
  // replacing it with the pending view and back makes Expo Router rebuild the
  // navigation state in a loop. The pending view covers it instead, and its
  // screens are hidden from assistive technology until the session is known.
  return (
    <View className="flex-1">
      <View
        className="flex-1"
        accessibilityElementsHidden={pending || unavailable}
        importantForAccessibility={pending || unavailable ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {pending ? (
        <View className="absolute inset-0 bg-background">
          {pendingView ?? (
            <View className="flex-1 items-center justify-center">
              <Spinner label={t("checking")} size="large" />
            </View>
          )}
        </View>
      ) : null}
      {unavailable ? (
        <View className="absolute inset-0 bg-background">{unavailableView}</View>
      ) : null}
      {redirect ? <Redirect href={redirect} /> : null}
    </View>
  );
}

/** Where the session rule of the focused route sends the user, if anywhere. */
function redirectFor(
  route: MobileRoute | undefined,
  shell: MobileShellId,
  { status, viewer }: Session,
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): Href | undefined {
  if (!route || route.shell !== shell) return undefined;
  if (route.session === "AUTHENTICATED" && status === "anonymous") {
    return signInHref(requestedPath(route, pathname, params));
  }
  if (route.session === "GUEST_ONLY" && status === "authenticated" && viewer !== undefined) {
    return routeHref(mobileGuards.entry, {}, continuationQuery(continuationOf(params)));
  }
  return undefined;
}

/** The requested path and its query; the route's own parameters are already in the path. */
function requestedPath(
  route: MobileRoute,
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const routeParams: readonly string[] = route.params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (routeParams.includes(key) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
