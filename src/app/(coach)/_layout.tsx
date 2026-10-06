import { Stack } from "expo-router";

import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";

// A deep link to a pushed screen keeps the tabs underneath it.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * mobile.coach: the coach shell. Coach tabs (Today, Fighters, Board, Requests, Inbox) in (tabs); every other
 * coach route is pushed above them. Capability (COACH) and
 * phase are registry metadata only until the identity tickets expose them.
 */
export default function CoachLayout() {
  return (
    <SessionGate shell="mobile.coach">
      <ShellStack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </ShellStack>
    </SessionGate>
  );
}
