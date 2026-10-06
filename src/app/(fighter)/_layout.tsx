import { Stack } from "expo-router";

import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.fighter: the fighter shell. Fighter tabs (Home, Training, Live Board, Community, Profile) in (tabs); every other
 * fighter route is pushed above them. Capability (FIGHTER) and
 * phase are registry metadata only until the identity tickets expose them.
 */
export default function FighterLayout() {
  return (
    <SessionGate shell="mobile.fighter">
      <ShellStack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </ShellStack>
    </SessionGate>
  );
}
