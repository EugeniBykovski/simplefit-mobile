import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "coach/today" };

/** The today tab: its root and the screens the design shows inside this tab. */
export default function TodayTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
