import { VerifyEmailScreen } from "@/widgets/fighter-coach-invitations";

/** FCI3 reused from the gym invitations (`mobile.me.gyms.invitations.verify-email`, SF-135). */
export default function GymInvitationVerifyEmailRoute() {
  return (
    <VerifyEmailScreen
      backTo="mobile.me.gyms.invitations"
      titleRoute="mobile/me/gyms/invitations/verify-email"
    />
  );
}
