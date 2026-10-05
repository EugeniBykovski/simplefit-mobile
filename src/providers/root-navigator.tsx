import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslations } from "use-intl";

import { useTheme } from "@/shared/styles/theme";

/** Root stack with themed, translated headers. */
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
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          headerTitleStyle: { fontFamily: "Manrope_700Bold" },
        }}
      >
        <Stack.Screen name="index" options={{ title: t("home"), headerShown: false }} />
        <Stack.Screen name="(app)" options={{ title: t("appShell") }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
