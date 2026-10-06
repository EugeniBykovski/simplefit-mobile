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

/**
 * The stack of one tab (`(<shell>)/(tabs)/(<tab>)/_layout.tsx`): the tab's
 * root route without a header (the tab bar is its navigation) and the
 * screens the design shows inside that tab, pushed with the tab bar still
 * visible and a back button to the root.
 */
export function TabStack({ root }: { root: string }) {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name={root} options={{ headerShown: false }} />
    </Stack>
  );
}
