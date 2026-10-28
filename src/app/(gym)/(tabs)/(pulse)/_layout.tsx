import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "gyms/[gymId]/pulse" };

/** The pulse tab: its root and the screens the design shows inside this tab. */
export default function PulseTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
