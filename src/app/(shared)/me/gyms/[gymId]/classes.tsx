import { useLocalSearchParams } from "expo-router";

import { MemberClassesScreen } from "@/widgets/gym-member-booking";

/**
 * F13 Book a class (`mobile.me.gyms._gym-id.classes`, SF-100): one gym's
 * classes for its member. The gym id only selects one of the viewer's own
 * memberships; the backend authorizes every request.
 */
export default function MemberClassesRoute() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  return <MemberClassesScreen key={gymId} gymId={gymId ?? ""} />;
}
