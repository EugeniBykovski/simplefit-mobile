import { Tabs, useNavigation } from "expo-router";
import { useEffect } from "react";

import { SpotlightProvider } from "@/shared/ui/spotlight";

import type { TabShell } from "../model/navigation";
import { useTabTitle } from "../model/tabs-title";
import { ShellTabBar } from "./shell-tab-bar";

/**
 * The tab navigator of a role shell, rendered by `(<shell>)/(tabs)/_layout.tsx`.
 * Each tab is a stack group (`(tabs)/(<item key>)`, TabStack) that keeps its
 * state while the user switches tabs; the shell's other routes are pushed
 * above the tabs by the shell's stack. The tab buttons and the screens share
 * one spotlight registry, so a tab's own guide can point at the tab bar.
 */
export function ShellTabs({ shell }: { shell: TabShell }) {
  // This layout's own screen in the shell's stack (`(tabs)`).
  const shellScreen = useNavigation();
  const title = useTabTitle(shell);

  return (
    <SpotlightProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state }) => {
          const focusedTab = state.routes[state.index]?.name;
          return (
            <>
              {focusedTab === undefined ? null : (
                <TabsTitle screen={shellScreen} title={title(focusedTab)} />
              )}
              <ShellTabBar shell={shell} focusedTab={focusedTab} />
            </>
          );
        }}
      />
    </SpotlightProvider>
  );
}

/**
 * Keeps the `(tabs)` screen titled after the focused tab, so a pushed
 * screen's native back button announces "Home" or "Training", not "(tabs)".
 */
function TabsTitle({
  screen,
  title,
}: {
  screen: { setOptions: (options: { title: string }) => void };
  title: string;
}) {
  useEffect(() => {
    screen.setOptions({ title });
  }, [screen, title]);
  return null;
}
