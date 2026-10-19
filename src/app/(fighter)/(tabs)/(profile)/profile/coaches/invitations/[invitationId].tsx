import { useLocalSearchParams } from "expo-router";

import { InvitationReviewScreen } from "@/widgets/fighter-coach-invitations";

/**
 * `mobile.profile.coaches.invitations._invitation-id` (FCI2, SF-76): one
 * incoming coach invitation. The segment is the SF-73 invitation id, never a
 * token; the screen checks it against the backend before showing anything.
 */
export default function InvitationReviewRoute() {
  const { invitationId } = useLocalSearchParams<{ invitationId: string }>();
  return <InvitationReviewScreen invitationId={invitationId} />;
}
