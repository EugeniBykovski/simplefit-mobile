import { CircleCheck, CircleX, Ellipsis } from "lucide-react-native";
import { useTranslations } from "use-intl";

import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { LucideIcon } from "@/shared/ui/icon";

import type { HealthStatus } from "../model/health-status";

const presentation: Record<HealthStatus, { icon: LucideIcon; variant: BadgeVariant }> = {
  checking: { icon: Ellipsis, variant: "neutral" },
  online: { icon: CircleCheck, variant: "success" },
  offline: { icon: CircleX, variant: "destructive" },
};

/** Status pill: icon + text + colour (never colour alone). */
export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const t = useTranslations("apiHealth.status");
  const { icon, variant } = presentation[status];

  return <Badge label={t(status)} variant={variant} icon={icon} />;
}
