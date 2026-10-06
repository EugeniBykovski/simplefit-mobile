import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "gym/check-in" };

/** The checkin tab: its root and the screens the design shows inside this tab. */
export default function CheckinTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
