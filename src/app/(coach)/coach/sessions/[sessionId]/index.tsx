import { useLocalSearchParams } from "expo-router";

import { CoachSessionScreen } from "@/widgets/coach-sessions";

/**
 * `mobile.coach.sessions._session-id` (CT3, SF-65): one session. The segment
 * authorizes nothing; the backend decides whether it is this coach's.
 */
export default function CoachSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <CoachSessionScreen sessionId={sessionId} />;
}
