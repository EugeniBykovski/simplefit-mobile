import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTranslations } from "use-intl";

import type { TrainingSessionStatus } from "@/entities/training-session";
import { Badge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

/** The backend status, in words (never colour alone); the planner's mapping (SF-64, SF-65). */
export function StatusBadge({ status }: { status: TrainingSessionStatus }) {
  const t = useTranslations("fighterTraining.status");
  return (
    <Badge
      label={t(status)}
      variant={status === "planned" ? "accent" : status === "completed" ? "success" : "neutral"}
    />
  );
}

/** A state of a screen that has no records to show (empty, not available). */
export function Message({
  icon,
  title,
  body,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${body}`}
      className="items-start gap-2.5 rounded-3xl border border-border bg-surface p-5"
      testID={testID}
    >
      <View className="size-11 items-center justify-center rounded-2xl bg-accent">
        <Icon icon={icon} color="highlight" />
      </View>
      <Text variant="h3">{title}</Text>
      <Text color="mutedForeground">{body}</Text>
    </View>
  );
}
