import { ShellTabs } from "@/widgets/shell-tabs";

export const unstable_settings = { initialRouteName: "coach/today" };

/** The coach tab bar (mobile.coach `navItems`). */
export default function CoachTabsLayout() {
  return <ShellTabs shell="coach" />;
}
