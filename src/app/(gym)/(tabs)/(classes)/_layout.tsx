import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "gyms/[gymId]/classes/index" };

/** The classes tab: its root and the screens the design shows inside this tab. */
export default function ClassesTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
