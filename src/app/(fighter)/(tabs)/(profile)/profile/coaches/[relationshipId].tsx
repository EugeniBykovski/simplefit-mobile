import { useLocalSearchParams } from "expo-router";

import { CoachRelationshipScreen } from "@/widgets/fighter-coaches";

/**
 * `mobile.profile.coaches._relationship-id` (FC2, SF-59): one coach
 * relationship. The segment is the SF-56 relationship id; the screen checks
 * it against the backend before showing anything.
 */
export default function CoachRelationshipRoute() {
  const { relationshipId } = useLocalSearchParams<{ relationshipId: string }>();
  return <CoachRelationshipScreen relationshipId={relationshipId} />;
}
