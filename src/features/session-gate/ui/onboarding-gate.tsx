import { Redirect, useGlobalSearchParams, usePathname } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { useSession } from "@/entities/session";
import { continuationOf } from "@/shared/routes/continuation";
import { matchMobileRoute, type MobileRouteId } from "@/shared/routes/routes";

import { destinationRoute, entryHref, knowsDestination } from "../model/entry";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

/** The role onboarding entry routes (Fighter, Coach, Gym) of `guards.entryDestinations`. */
const ROLE_ONBOARDING: ReadonlySet<MobileRouteId> = new Set([
  destinationRoute("fighter_onboarding"),
  destinationRoute("coach_onboarding"),
  destinationRoute("gym_onboarding"),
]);
const ACCOUNT_REGISTRATION = destinationRoute("account_registration");
const ROLE_SELECTION = destinationRoute("role_selection");

/**
 * Keeps the onboarding routes in the backend's order (SF-45), as the web
 * client's gate does:
 *
 * - a Fighter, Coach or Gym onboarding screen opened while account
 *   registration is incomplete goes to it (O04) with the screen's
 *   continuation;
 * - O04 shows only while account registration is incomplete: once it is
 *   complete (here or on another client) it continues to the resolved entry;
 * - O05 shows only for a destination that maps to it (`role_selection`, and
 *   `sponsor_application`, whose web hand-off starts there): any other answer
 *   (an intent, an existing Fighter, an incomplete account) continues to that
 *   destination, so nothing bounces.
 *
 * A destination this client does not map is a failure, never guessed.
 * Nothing else is decided here; the API authorizes. Like SessionGate, the
 * navigator stays mounted and the gate covers it.
 */
export function OnboardingGate({
  pending: pendingView,
  failure,
  children,
}: {
  pending: ReactNode;
  failure: ReactNode;
  children: ReactNode;
}) {
  const { status } = useSession();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const [continuation] = useState(() => continuationOf(params));
  const route = matchMobileRoute(pathname)?.id;
  const onRegistration = route === ACCOUNT_REGISTRATION;
  const onSelection = route === ROLE_SELECTION;
  const applies =
    route !== undefined &&
    status === "authenticated" &&
    (ROLE_ONBOARDING.has(route) || onRegistration || onSelection);
  const query = useEntry(continuation, applies);

  const unknown = query.data !== undefined && !knowsDestination(query.data.destination);
  const entry = applies && !unknown ? query.data : undefined;
  const gated = entry?.destination === "account_registration";
  const misplaced =
    entry !== undefined &&
    (gated !== onRegistration ||
      // O05 is also the mobile Sponsor application (`sponsor_application` maps here).
      (onSelection && destinationRoute(entry.destination) !== ROLE_SELECTION));
  const redirect = misplaced ? entryHref(entry, continuation) : undefined;
  const failed = applies && (query.isError || unknown);
  const covered = applies && (failed || entry === undefined || redirect !== undefined);

  return (
    <View className="flex-1">
      <View
        className="flex-1"
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {covered ? (
        <View className="absolute inset-0 bg-background">
          {failed ? (
            <EntryFailureBoundary
              error={query.error ?? new Error("Unknown entry destination")}
              retry={() => void query.refetch()}
              failure={failure}
            />
          ) : (
            pendingView
          )}
        </View>
      ) : null}
      {redirect !== undefined ? <Redirect href={redirect} /> : null}
    </View>
  );
}
