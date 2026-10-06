import { Tabs } from "expo-router";

import type { TabShell } from "../model/navigation";
import { ShellTabBar } from "./shell-tab-bar";

/**
 * The tab navigator of a role shell: its tab routes keep their state while
 * the user switches tabs, and the shell's other routes are pushed above it
 * by the shell's stack. Rendered by `(<shell>)/(tabs)/_layout.tsx`.
 */
export function ShellTabs({ shell }: { shell: TabShell }) {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <ShellTabBar shell={shell} />} />
  );
}
