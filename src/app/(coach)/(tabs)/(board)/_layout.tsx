import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "coach/board" };

/** The board tab: its root and the screens the design shows inside this tab. */
export default function BoardTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
