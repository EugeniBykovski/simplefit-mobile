import { Stack } from "expo-router";

import { CapabilityGate, SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { EntryFailure, LaunchScreen, SessionFailure } from "@/widgets/system-states";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.coach: the coach shell. Coach tabs (Today, Fighters, Board, Requests, Inbox) in (tabs); every other
 * coach route is pushed above them. Its screens need the COACH capability
 * the entry reports (SF-53); anyone else goes where the entry sends them.
 */
export default function CoachLayout() {
  return (
    <SessionGate shell="mobile.coach" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <CapabilityGate shell="mobile.coach" pending={<LaunchScreen />} failure={<EntryFailure />}>
        <ShellStack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </ShellStack>
      </CapabilityGate>
    </SessionGate>
  );
}
