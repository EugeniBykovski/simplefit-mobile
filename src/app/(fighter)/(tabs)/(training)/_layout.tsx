import { TabStack } from "@/providers/shell-stack";

export const unstable_settings = { initialRouteName: "training" };

/** The training tab: its root and the screens the design shows inside this tab. */
export default function TrainingTabLayout() {
  return <TabStack root={unstable_settings.initialRouteName} />;
}
