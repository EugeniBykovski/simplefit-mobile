import { useLocalSearchParams } from "expo-router";

import { CoachSessionsScreen } from "@/widgets/coach-sessions";

/**
 * `mobile.coach.sessions` (CT1, SF-65): the Coach app's Sessions tab.
 * `?view=history` selects History, narrowed by `?status=completed|cancelled`;
 * anything else is Upcoming. The Coach capability gate of the `(coach)`
 * layout has already run.
 */
export default function CoachSessionsRoute() {
  const { view, status } = useLocalSearchParams<{ view?: string; status?: string }>();
  const history = view === "history";
  return (
    <CoachSessionsScreen
      view={history ? "history" : "upcoming"}
      filter={history && (status === "completed" || status === "cancelled") ? status : "all"}
    />
  );
}
