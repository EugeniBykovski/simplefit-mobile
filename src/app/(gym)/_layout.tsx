import { Stack } from "expo-router";

import { CapabilityGate, SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { GymGate } from "@/widgets/gym-workspace";
import { EntryFailure, FailureView, LaunchScreen, SessionFailure } from "@/widgets/system-states";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.gym: the gym shell of the gym in the route (`/gyms/:gymId/**`,
 * SF-89, ADR 0026 D-G23). Gym tabs (Pulse, Classes, QR check-in, Members,
 * Staff) in (tabs); every other gym route is pushed above them. Its screens
 * need the GYM_WORKSPACE capability the entry reports (anyone else goes where
 * the entry sends them), then the backend's answer for that gym (GymGate:
 * not available, role-restricted, draft or failure states).
 */
export default function GymLayout() {
  return (
    <SessionGate shell="mobile.gym" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <CapabilityGate shell="mobile.gym" pending={<LaunchScreen />} failure={<EntryFailure />}>
        <GymGate failure={(error, retry) => <FailureView error={error} onRetry={retry} />}>
          <ShellStack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </ShellStack>
        </GymGate>
      </CapabilityGate>
    </SessionGate>
  );
}
