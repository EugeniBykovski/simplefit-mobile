import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { LaunchScreen, SessionFailure } from "@/widgets/system-states";

/** mobile.onboarding: registration wizards and first-run intros, without a tab bar. */
export default function OnboardingLayout() {
  return (
    <SessionGate
      shell="mobile.onboarding"
      pending={<LaunchScreen />}
      unavailable={<SessionFailure />}
    >
      <ShellStack />
    </SessionGate>
  );
}
