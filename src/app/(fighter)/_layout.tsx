import { Stack } from "expo-router";

import { CapabilityGate, SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { EntryFailure, LaunchScreen, SessionFailure } from "@/widgets/system-states";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.fighter: the fighter shell. Fighter tabs (Home, Training, Live Board, Community, Profile) in (tabs); every other
 * fighter route is pushed above them. Since SF-66 its routes that need the
 * FIGHTER capability render only when the entry reports it (CapabilityGate,
 * as the Coach shell since SF-53); anyone else goes where the entry sends them.
 */
export default function FighterLayout() {
  return (
    <SessionGate shell="mobile.fighter" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <CapabilityGate shell="mobile.fighter" pending={<LaunchScreen />} failure={<EntryFailure />}>
        <ShellStack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </ShellStack>
      </CapabilityGate>
    </SessionGate>
  );
}
