import { Stack } from "expo-router";

import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { LaunchScreen, SessionFailure } from "@/widgets/system-states";

/**
 * mobile.auth: welcome, sign in and sign up, consent, role choice and invite
 * links, without a tab bar. Its routes mix PUBLIC (invite links),
 * GUEST_ONLY (welcome, sign in, sign up) and AUTHENTICATED (consent, role
 * choice) access; SessionGate applies each route's own rule.
 */
export default function AuthLayout() {
  return (
    <SessionGate shell="mobile.auth" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <ShellStack>
        {/* The designed auth screens draw their own back button (SF-24). */}
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="login/code" options={{ headerShown: false }} />
        <Stack.Screen name="signup/index" options={{ headerShown: false }} />
        <Stack.Screen name="signup/verify" options={{ headerShown: false }} />
      </ShellStack>
    </SessionGate>
  );
}
