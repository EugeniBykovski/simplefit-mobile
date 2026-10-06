import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "profile" };

/** The profile tab: its root and the screens the design shows inside this tab. */
export default function ProfileTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
