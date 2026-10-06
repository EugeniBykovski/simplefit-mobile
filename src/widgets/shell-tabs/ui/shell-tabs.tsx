import { Tabs } from "expo-router";

import type { TabShell } from "../model/navigation";
import { ShellTabBar } from "./shell-tab-bar";

/**
 * The tab navigator of a role shell, rendered by `(<shell>)/(tabs)/_layout.tsx`.
 * Each tab is a stack group (`(tabs)/(<item key>)`, TabStack) that keeps its
 * state while the user switches tabs; the shell's other routes are pushed
 * above the tabs by the shell's stack.
 */
export function ShellTabs({ shell }: { shell: TabShell }) {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => (
        <ShellTabBar shell={shell} focusedTab={state.routes[state.index]?.name} />
      )}
    />
  );
}
