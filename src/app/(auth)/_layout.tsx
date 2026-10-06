import { Stack } from "expo-router";
import { useTranslations } from "use-intl";

import { SessionGate } from "@/features/session-gate";
import { ShellStack } from "@/providers/shell-stack";

/**
 * mobile.auth: welcome, sign in and sign up, consent, role choice and invite
 * links, without a tab bar. Its routes mix PUBLIC (invite links),
 * GUEST_ONLY (welcome, sign in, sign up) and AUTHENTICATED (consent, role
 * choice) access; SessionGate applies each route's own rule.
 */
export default function AuthLayout() {
  const auth = useTranslations("auth");

  return (
    <SessionGate shell="mobile.auth">
      <ShellStack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: auth("welcome.signIn") }} />
      </ShellStack>
    </SessionGate>
  );
}
