import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslations } from "use-intl";

import { useTheme } from "@/shared/styles/theme";

import { stackScreenOptions } from "./shell-stack";

/**
 * Root stack (mobile.root) with themed, translated headers. Each registry
 * shell is a route group with its own layout and stack (route-architecture
 * §12); groups do not change URLs.
 */
export function RootNavigator() {
  const t = useTranslations("navigation");
  const { scheme, colors } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: colors.background,
          card: colors.background,
          notification: colors.warning,
          text: colors.foreground,
          border: colors.border,
          primary: colors.primary,
        },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ title: t("home"), headerShown: false }} />
        <Stack.Screen name="app" options={{ title: t("appShell") }} />
        <Stack.Screen name="+not-found" />
        {SHELL_GROUPS.map((group) => (
          <Stack.Screen key={group} name={group} options={{ headerShown: false }} />
        ))}
      </Stack>
    </ThemeProvider>
  );
}

/** Shell route groups: each renders its own stack and headers. */
const SHELL_GROUPS = ["(auth)", "(onboarding)", "(fighter)", "(coach)", "(gym)", "(shared)"];
