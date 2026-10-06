import { Stack } from "expo-router";

import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.gym: the gym shell. Gym tabs (Pulse, Classes, QR check-in, Members, Staff) in (tabs); every other
 * gym route is pushed above them. Capability (GYM_WORKSPACE) and
 * phase are registry metadata only until the identity tickets expose them.
 */
export default function GymLayout() {
  return (
    <SessionGate shell="mobile.gym">
      <ShellStack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </ShellStack>
    </SessionGate>
  );
}
