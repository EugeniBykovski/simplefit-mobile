import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "coach/fighters" };

/** The fighters tab: its root and the screens the design shows inside this tab. */
export default function FightersTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
