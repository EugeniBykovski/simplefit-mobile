import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "community" };

/** The community tab: its root and the screens the design shows inside this tab. */
export default function CommunityTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
