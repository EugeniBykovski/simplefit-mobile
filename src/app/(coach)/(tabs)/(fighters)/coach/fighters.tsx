import { useLocalSearchParams } from "expo-router";

import { CoachFightersScreen } from "@/widgets/coach-fighters";

/**
 * `mobile.coach.fighters` (C03, SF-61): the Coach app's Fighters tab.
 * `?view=ended` and `?view=invitations` select the other views; anything else
 * is the active roster. The Coach capability gate of the `(coach)` layout has
 * already run.
 */
export default function CoachFightersRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return (
    <CoachFightersScreen view={view === "ended" || view === "invitations" ? view : "active"} />
  );
}
