import { useLocalSearchParams } from "expo-router";

import { CoachSessionEditScreen } from "@/widgets/coach-sessions";

/** `mobile.coach.sessions._session-id.edit` (CT4, SF-65): a planned session's form. */
export default function CoachSessionEditRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <CoachSessionEditScreen sessionId={sessionId} />;
}
