import { ShellTabs } from "@/widgets/shell-tabs";

export const unstable_settings = { initialRouteName: "(home)" };

/** The fighter tab bar (mobile.fighter `navItems`). */
export default function FighterTabsLayout() {
  return <ShellTabs shell="fighter" />;
}
