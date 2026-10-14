import { Redirect, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { useSession } from "@/entities/session";
import { matchMobileRoute, type MobileShellId } from "@/shared/routes/routes";

import { entryHref, isKnownEntry } from "../model/entry";
import { EntryFailureBoundary, useEntry } from "./entry-redirect";

const NO_CONTINUATION = {};

/**
 * Capability guard of a workspace shell (SF-53; route-architecture §9): a
 * focused route of `shell` whose registry access names a capability renders
 * only when the backend entry (`GET /api/v1/me/entry`, SF-51) reports it.
 * Anyone else goes where the entry sends them (their onboarding, their home,
 * O05), never to a guessed screen. It checks the capability, not the last
 * chosen context, so a person holding FIGHTER and COACH opens either
 * workspace. Coach onboarding sits in the onboarding shell, outside this
 * gate, so it is reachable before COACH exists.
 *
 * UX only: the API authorizes every request. Like SessionGate, the navigator
 * stays mounted and the gate covers it.
 */
export function CapabilityGate({
  shell,
  pending: pendingView,
  failure,
  children,
}: {
  shell: MobileShellId;
  pending: ReactNode;
  failure: ReactNode;
  children: ReactNode;
}) {
  const { status } = useSession();
  const pathname = usePathname();
  const route = matchMobileRoute(pathname);
  const capability = route?.shell === shell ? route.capability : null;
  const applies = status === "authenticated" && capability !== null;
  const query = useEntry(NO_CONTINUATION, applies);

  const unknown = query.data !== undefined && !isKnownEntry(query.data);
  const entry =
    applies && query.data !== undefined && isKnownEntry(query.data) ? query.data : undefined;
  const held: readonly string[] = entry?.capabilities ?? [];
  const redirect =
    entry !== undefined && capability !== null && !held.includes(capability)
      ? entryHref(entry)
      : undefined;
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
