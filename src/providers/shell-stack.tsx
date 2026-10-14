import { Stack, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ComponentProps, ReactNode } from "react";
import { Pressable } from "react-native";
import { useTranslations } from "use-intl";

import { Icon } from "@/shared/ui/icon";

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
  return (
    <Stack
      screenOptions={({ navigation, route }) => ({
        ...stackScreenOptions,
        // The first screen of a shell opened from another shell (the shared
        // Settings from the Coach tab bar, SF-55) has nothing to go back to in
        // its own stack, so the header draws no back button: it goes back to
        // the screen it was opened from.
        ...(navigation.getState().routes[0]?.key === route.key &&
        (navigation.getParent()?.getState().index ?? 0) > 0
          ? { headerLeft: () => <ParentBack /> }
          : {}),
      })}
    >
      {children}
    </Stack>
  );
}

/** Back to the screen this shell was opened from (the parent stack). */
function ParentBack() {
  const t = useTranslations("navigation");
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("back")}
      hitSlop={8}
      onPress={() => router.back()}
      className="size-11 items-center justify-center"
    >
      <Icon icon={ChevronLeft} size={24} />
    </Pressable>
  );
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
