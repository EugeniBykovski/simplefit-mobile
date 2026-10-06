import { type Href, Redirect, useGlobalSearchParams, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import { useSessionStatus } from "@/entities/session";
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
 *   visitors to the sign-in route with `returnTo`;
 * - GUEST_ONLY: sends signed-in users to the entry route.
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
export function SessionGate({ shell, children }: { shell: MobileShellId; children: ReactNode }) {
  const status = useSessionStatus();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const t = useTranslations("auth.session");
  const route = matchMobileRoute(pathname);

  const redirect = redirectFor(route, shell, status, pathname, params);
  const pending =
    route !== undefined &&
    route.shell === shell &&
    route.session !== "PUBLIC" &&
    status === "loading";

  // The shell's navigator stays mounted while the session is checked:
  // replacing it with the pending view and back makes Expo Router rebuild the
  // navigation state in a loop. The pending view covers it instead, and its
  // screens are hidden from assistive technology until the session is known.
  return (
    <View className="flex-1">
      <View
        className="flex-1"
        accessibilityElementsHidden={pending}
        importantForAccessibility={pending ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {pending ? (
        <View className="absolute inset-0 items-center justify-center bg-background">
          <Spinner label={t("checking")} size="large" />
        </View>
      ) : null}
      {redirect ? <Redirect href={redirect} /> : null}
    </View>
  );
}

/** Where the session rule of the focused route sends the user, if anywhere. */
function redirectFor(
  route: MobileRoute | undefined,
  shell: MobileShellId,
  status: ReturnType<typeof useSessionStatus>,
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): Href | undefined {
  if (!route || route.shell !== shell) return undefined;
  if (route.session === "AUTHENTICATED" && status === "anonymous") {
    return signInHref(requestedPath(route, pathname, params));
  }
  if (route.session === "GUEST_ONLY" && status === "authenticated") {
    return routeHref(mobileGuards.entry);
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
