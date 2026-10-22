import { VerifyEmailScreen } from "@/widgets/fighter-coach-invitations";

/**
 * `mobile.profile.coaches.invitations.verify-email` (FCI3, SF-79): add an
 * email identity to this account with an SF-77 code, so invitations sent to
 * that address reach the fighter's inbox. Nothing secret is in the route.
 */
export default function VerifyEmailRoute() {
  return <VerifyEmailScreen />;
}
