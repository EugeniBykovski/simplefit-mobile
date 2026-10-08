import { OnboardingGate, SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { EntryFailure, LaunchScreen, SessionFailure } from "@/widgets/system-states";

/**
 * mobile.onboarding: registration wizards and first-run intros, without a tab
 * bar. Role onboarding comes after account registration (SF-45).
 */
export default function OnboardingLayout() {
  return (
    <SessionGate
      shell="mobile.onboarding"
      pending={<LaunchScreen />}
      unavailable={<SessionFailure />}
    >
      <OnboardingGate pending={<LaunchScreen />} failure={<EntryFailure />}>
        <ShellStack />
      </OnboardingGate>
    </SessionGate>
  );
}
