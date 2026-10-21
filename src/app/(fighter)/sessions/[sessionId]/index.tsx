import { useLocalSearchParams } from "expo-router";

import { FighterSessionScreen } from "@/widgets/fighter-training";

/**
 * `mobile.sessions._session-id` (FT2, SF-66): one of the fighter's own
 * sessions. The segment authorizes nothing; the backend decides whether it is
 * this fighter's.
 */
export default function FighterSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <FighterSessionScreen sessionId={sessionId} />;
}
