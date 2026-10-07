import { Timer } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

/** The Corner Tip card of LD1: a boxing tip, never data. */
export function CornerTip({ label, tip }: { label: string; tip: string }) {
  return (
    <View className="w-full flex-row items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
      <View className="size-[34px] items-center justify-center rounded-md bg-accent">
        <Icon icon={Timer} size={17} color="highlight" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" color="faintForeground">
          {label}
        </Text>
        <Text variant="bodySm" className="opacity-80">
          {tip}
        </Text>
      </View>
    </View>
  );
}
