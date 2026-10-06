import { Stack } from "expo-router";
import type { ComponentProps, ReactNode } from "react";

/** Header defaults of every stack: the root stack and each shell's stack. */
export const stackScreenOptions = {
  headerBackButtonDisplayMode: "minimal",
  headerTitleStyle: { fontFamily: "Manrope_700Bold" },
} satisfies ComponentProps<typeof Stack>["screenOptions"];

/**
 * The stack of a shell layout. Screens are pushed with the shared header
 * defaults; a placeholder sets its title from the registry route
 * (FeaturePlaceholder), a real screen sets its own.
 */
export function ShellStack({ children }: { children?: ReactNode }) {
  return <Stack screenOptions={stackScreenOptions}>{children}</Stack>;
}
