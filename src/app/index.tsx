import { useSession } from "@/entities/session";
import { EntryRedirect } from "@/features/session-gate";
import { FoundationHome } from "@/widgets/foundation-home";
import { EntryFailure, LaunchScreen, SessionFailure } from "@/widgets/system-states";

/**
 * `mobile.root` (ENTRY, LD1). A signed-in user is sent where the backend
 * entry resolution says (SF-45), with the continuation the auth screens
 * handed over; the launch screen shows while the session is restored and the
 * entry resolved. A signed-out visitor still sees the SF-12 foundation home
 * (D-PRODUCTION-FOUNDATION).
 */
export default function EntryRoute() {
  const { status } = useSession();

  if (status === "authenticated") {
    return <EntryRedirect pending={<LaunchScreen />} failure={<EntryFailure />} />;
  }
  if (status === "unavailable") return <SessionFailure />;
  if (status === "loading") return <LaunchScreen />;
  return <FoundationHome />;
}
