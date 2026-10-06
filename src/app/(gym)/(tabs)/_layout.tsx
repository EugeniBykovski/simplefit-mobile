import { ShellTabs } from "@/widgets/shell-tabs";

export const unstable_settings = { initialRouteName: "gym/pulse" };

/** The gym tab bar (mobile.gym `navItems`). */
export default function GymTabsLayout() {
  return <ShellTabs shell="gym" />;
}
