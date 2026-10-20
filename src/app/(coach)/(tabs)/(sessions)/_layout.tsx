import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "coach/sessions" };

/** The sessions tab: its root and the screens the design shows inside this tab. */
export default function SessionsTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
