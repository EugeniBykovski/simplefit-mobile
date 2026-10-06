import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "gym/members/index" };

/** The members tab: its root and the screens the design shows inside this tab. */
export default function MembersTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
