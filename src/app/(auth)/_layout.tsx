import { Stack } from "expo-router";

import { OnboardingGate, SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";
import { EntryFailure, LaunchScreen, SessionFailure } from "@/widgets/system-states";

/**
 * mobile.auth: welcome, sign in and sign up, consent, role choice and invite
 * links, without a tab bar. Its routes mix PUBLIC (invite links),
 * GUEST_ONLY (welcome, sign in, sign up) and AUTHENTICATED (consent, role
 * choice) access; SessionGate applies each route's own rule. OnboardingGate
 * keeps O04 and O05 in the backend's order (SF-45, SF-37).
 */
export default function AuthLayout() {
  return (
    <SessionGate shell="mobile.auth" pending={<LaunchScreen />} unavailable={<SessionFailure />}>
      <OnboardingGate pending={<LaunchScreen />} failure={<EntryFailure />}>
        <ShellStack>
          {/* The designed auth screens draw their own back button (SF-24). */}
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="login/code" options={{ headerShown: false }} />
          <Stack.Screen name="signup/index" options={{ headerShown: false }} />
          <Stack.Screen name="signup/verify" options={{ headerShown: false }} />
          <Stack.Screen name="signup/consent" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/role" options={{ headerShown: false }} />
        </ShellStack>
      </OnboardingGate>
    </SessionGate>
  );
}
