import { Redirect, useGlobalSearchParams, usePathname } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { useSession } from "@/entities/session";
import { continuationOf } from "@/shared/routes/continuation";
import { matchMobileRoute, type MobileRouteId } from "@/shared/routes/routes";

import { destinationRoute, entryHref } from "../model/entry";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

/** The role onboarding entry routes (Fighter, Coach, Gym) of `guards.entryDestinations`. */
const ROLE_ONBOARDING: ReadonlySet<MobileRouteId> = new Set([
  destinationRoute("fighter_onboarding"),
  destinationRoute("coach_onboarding"),
  destinationRoute("gym_onboarding"),
]);

/**
 * Keeps role onboarding behind account registration (SF-45): a Fighter,
 * Coach or Gym onboarding screen opened while account registration is
 * incomplete goes to it (O04) with the screen's continuation. Nothing else
 * is decided here; the API authorizes. Like SessionGate, the navigator stays
 * mounted and the gate covers it.
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
  const route = matchMobileRoute(pathname);
  const applies =
    route !== undefined && ROLE_ONBOARDING.has(route.id) && status === "authenticated";
  const query = useEntry(continuation, applies);

  const entry = applies ? query.data : undefined;
  const redirect =
    entry?.destination === "account_registration" ? entryHref(entry, continuation) : undefined;
  const covered = applies && (query.isError || entry === undefined || redirect !== undefined);

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
          {query.isError ? (
            <EntryFailureBoundary
              error={query.error}
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
