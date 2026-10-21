import { useLocalSearchParams } from "expo-router";

import { FighterTrainingScreen } from "@/widgets/fighter-training";

/**
 * `mobile.training` (FT1, SF-66): the Fighter app's Training tab.
 * `?view=history` selects History, narrowed by `?status=completed|cancelled`;
 * anything else is Upcoming. The FIGHTER capability gate of the `(fighter)`
 * layout has already run.
 */
export default function FighterTrainingRoute() {
  const { view, status } = useLocalSearchParams<{ view?: string; status?: string }>();
  const history = view === "history";
  return (
    <FighterTrainingScreen
      view={history ? "history" : "upcoming"}
      filter={history && (status === "completed" || status === "cancelled") ? status : "all"}
    />
  );
}
