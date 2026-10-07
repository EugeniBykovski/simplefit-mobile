import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { LaunchScreen, SessionFailure } from "@/widgets/system-states";

/**
 * mobile.shared: account-level screens (settings, billing, checkout,
 * messages, notifications, search, workspaces, restricted-account pages)
 * pushed above the active role's tabs. Account level: no capability
 * (D-SHARED-ROUTES-ON-PERSONA-PAGES). /checkout is PUBLIC (D-GUEST-CHECKOUT).
 */
export default function SharedLayout() {
  return (
    <SessionGate shell="mobile.shared" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <ShellStack />
    </SessionGate>
  );
}
