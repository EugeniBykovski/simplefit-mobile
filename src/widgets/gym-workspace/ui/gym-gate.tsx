import { useGlobalSearchParams, usePathname } from "expo-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useTranslations } from "use-intl";

import { useGym, type Gym } from "@/entities/gym";
import { useSession } from "@/entities/session";
import { ApiError, isApiError } from "@/shared/api/http/api-error";
import { matchMobileRoute, type MobileShellId } from "@/shared/routes/routes";
import { Spinner } from "@/shared/ui/spinner";

import { GymDraftState, GymNotAvailable, GymRestricted } from "./gym-states";

const GymWorkspaceContext = createContext<Gym | undefined>(undefined);

/**
 * The gym the enclosing gym shell shows: the backend's answer for the gym in
 * the route, read and authorized for that id. `gymId` is the screen's own
 * route parameter; only that gym's answer is returned, so a screen never
 * renders another tenant's data, not even during a switch.
 */
export function useGymWorkspace(gymId: string): Gym | undefined {
  const gym = useContext(GymWorkspaceContext);
  return gym?.id === gymId ? gym : undefined;
}

/** What the gate shows for a failed read: the app's failure view, with a retry. */
export type GymFailure = (error: unknown, retry: () => void) => ReactNode;

/** Offline before the first answer: the query waits for the network, shown as offline. */
const OFFLINE = new ApiError("network", 0, "network_error", "Offline", {}, null);

/** Whether a failed read means the gym is not this user's (404) or not for their role (403). */
const statusOf = (error: unknown) => (isApiError(error) ? error.status : undefined);

const SHELL: MobileShellId = "mobile.gym";

/**
 * The gym gate of the gym shell (`mobile.gym`, `/gyms/:gymId/**`; SF-89),
 * inside the session and capability gates. The id in the route is only a
 * lookup key (ADR 0026 D-G15, D-G23): `GET /api/v1/gyms/{gym_id}` answers
 * only for active staff of that gym, and the shell's screens are uncovered
 * only with that answer.
 *
 * - **Not available** (404: unknown, foreign, malformed or revoked; route
 *   rule 9): one state that never says which, with the way to the user's own
 *   gyms. A re-read that turns into 404 (a membership revoked while open,
 *   noticed when the app returns to the foreground) covers whatever was
 *   shown.
 * - **Role-restricted** (403, D-G24): the role-restriction state.
 * - **Draft**: a gym whose setup is not completed is never a workspace; its
 *   owner continues setup.
 * - **Failure** (offline, 5xx): a retry; a failed background re-read keeps
 *   the gym already shown, since nothing says it changed. Offline before the
 *   first answer is the offline state, never an empty gym.
 * - **401**: the session layer refreshes once, then ends the session and the
 *   session gate signs in again (rule 2).
 *
 * The read waits for the restored session. While a screen of another shell
 * is on top (Settings above the gym), the gate keeps the gym it showed.
 * Switching gyms changes the route: the next gym loads under its own key
 * behind the pending view (never the previous gym's content) and is
 * announced to screen readers. Like the other gates, the navigator stays
 * mounted and the gate covers it.
 */
export function GymGate({ failure, children }: { failure: GymFailure; children: ReactNode }) {
  const t = useTranslations("gymShell");
  const { status: session } = useSession();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ gymId?: string }>();
  const focused = matchMobileRoute(pathname)?.shell === SHELL;
  const routeGymId = focused && typeof params.gymId === "string" ? params.gymId : undefined;

  const [gymId, setGymId] = useState(routeGymId);
  if (routeGymId !== undefined && routeGymId !== gymId) setGymId(routeGymId);

  const query = useGym(session === "authenticated" ? gymId : undefined);
  // Only the answer for this very id is ever shown.
  const gym = gymId !== undefined && query.data?.id === gymId ? query.data : undefined;
  const status = query.isError ? statusOf(query.error) : undefined;
  const refused = status === 404 || status === 403;
  const shown = gym !== undefined && !refused && gym.setup_status === "completed" ? gym : undefined;

  const shownId = shown?.id;
  const shownName = shown?.name;
  useEffect(() => {
    if (shownName !== undefined)
      AccessibilityInfo.announceForAccessibility(t("announcement", { name: shownName }));
  }, [shownId, shownName, t]);

  let cover: ReactNode;
  if (gymId === undefined || session !== "authenticated") cover = undefined;
  else if (status === 404) cover = <GymNotAvailable />;
  else if (status === 403) cover = <GymRestricted gymId={gymId} />;
  else if (gym === undefined) {
    if (query.isError && status !== 401) cover = failure(query.error, () => void query.refetch());
    else if (query.fetchStatus === "paused") cover = failure(OFFLINE, () => void query.refetch());
    else
      cover = (
        <View className="flex-1 items-center justify-center bg-background">
          <Spinner label={t("opening")} size="large" />
        </View>
      );
  } else if (gym.setup_status === "draft") cover = <GymDraftState gym={gym} />;

  const covered = cover !== undefined;
  return (
    <GymWorkspaceContext value={shown}>
      <View className="flex-1">
        <View
          className="flex-1"
          accessibilityElementsHidden={covered}
          importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
        >
          {children}
        </View>
        {covered ? <View className="absolute inset-0 bg-background">{cover}</View> : null}
      </View>
    </GymWorkspaceContext>
  );
}
