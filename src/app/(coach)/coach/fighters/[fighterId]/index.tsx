import { useLocalSearchParams } from "expo-router";

import { CoachFighterScreen } from "@/widgets/coach-fighters";

/**
 * `mobile.coach.fighters._fighter-id` (C04, SF-61): one fighter. The segment
 * is the SF-56 relationship id; the backend decides whether it is this
 * coach's and still active.
 */
export default function CoachFighterRoute() {
  const { fighterId } = useLocalSearchParams<{ fighterId: string }>();
  return <CoachFighterScreen relationshipId={fighterId} />;
}
