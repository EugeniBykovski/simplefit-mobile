import { useLocalSearchParams } from "expo-router";

import { MyCoachesScreen } from "@/widgets/fighter-coaches";

/**
 * `mobile.profile.coaches` (FC1, SF-59): the fighter's coaches. `?view=ended`
 * shows the ended relationships; any other value is the active list. The
 * Fighter capability gate of the `(fighter)` layout has already run.
 */
export default function MyCoachesRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return <MyCoachesScreen view={view === "ended" ? "ended" : "active"} />;
}
