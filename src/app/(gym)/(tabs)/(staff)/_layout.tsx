import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "gym/staff/on-shift" };

/** The staff tab: its root and the screens the design shows inside this tab. */
export default function StaffTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
