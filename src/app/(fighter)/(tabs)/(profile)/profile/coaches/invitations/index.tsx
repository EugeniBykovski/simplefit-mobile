import { InvitationsScreen } from "@/widgets/fighter-coach-invitations";

/**
 * `mobile.profile.coaches.invitations` (FCI1, SF-76): the coach invitations
 * addressed to the fighter's verified email identities. The Fighter
 * capability gate of the `(fighter)` layout has already run.
 */
export default function InvitationsRoute() {
  return <InvitationsScreen />;
}
