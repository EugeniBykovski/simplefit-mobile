import { View } from "react-native";
import { useTranslations } from "use-intl";

import { Icon, type IconName } from "@/shared/ui/icon";
import { Text, type TextColor } from "@/shared/ui/text";

import type { HealthStatus } from "../model/health-status";

const presentation: Record<
  HealthStatus,
  {
    icon: IconName;
    container: string;
    foreground: TextColor & ("foreground" | "successForeground" | "dangerForeground");
  }
> = {
  checking: { icon: "ellipsis-horizontal", container: "bg-muted", foreground: "foreground" },
  online: { icon: "checkmark-circle", container: "bg-success", foreground: "successForeground" },
  offline: { icon: "close-circle", container: "bg-danger", foreground: "dangerForeground" },
};

/** Status pill: icon + text + colour (never colour alone). */
export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const t = useTranslations("apiHealth.status");
  const { icon, container, foreground } = presentation[status];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(status)}
      className={`flex-row items-center gap-1 self-start rounded-full px-3 py-1 ${container}`}
    >
      <Icon name={icon} size={14} color={foreground} />
      <Text variant="caption" color={foreground} className="font-semibold">
        {t(status)}
      </Text>
    </View>
  );
}
