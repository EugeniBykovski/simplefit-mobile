import { View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";

import { HealthStatusBadge, toHealthStatus } from "@/entities/system-health";
import { useGetHealth } from "@/shared/api/generated/endpoints/system/system";
import { isApiError } from "@/shared/api/http/api-error";
import { publicEnv } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Text } from "@/shared/ui/text";

/**
 * Checks SimpleFit API availability through the generated TanStack Query hook
 * (env -> transport -> generated client -> Query). Network failures and
 * timeouts render "offline" with the error code; nothing is faked.
 */
export function ApiHealthCard() {
  const t = useTranslations("apiHealth");
  const actions = useTranslations("actions");
  const format = useFormatter();
  const health = useGetHealth({
    query: { retry: false, staleTime: 0 },
    request: { timeoutMs: 8_000 },
  });
  const status = toHealthStatus(health);
  const checkedAt = Math.max(health.dataUpdatedAt, health.errorUpdatedAt);

  return (
    <Card>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="heading" className="shrink">
          {t("title")}
        </Text>
        <HealthStatusBadge status={status} />
      </View>
      <Text variant="caption" color="mutedForeground" selectable>
        {publicEnv.apiUrl}
      </Text>
      <View accessibilityLiveRegion="polite" className="gap-1">
        <Text>{t(status)}</Text>
        {status === "offline" && isApiError(health.error) ? (
          <>
            <Text color="mutedForeground">
              {t.rich("errorCode", {
                errorCode: health.error.code,
                code: (chunks) => <Text className="font-mono">{chunks}</Text>,
              })}
            </Text>
            {health.error.requestId ? (
              <Text color="mutedForeground">
                {t("requestId", { requestId: health.error.requestId })}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
      <Text variant="caption" color="mutedForeground">
        {checkedAt > 0
          ? t("lastChecked", { time: format.dateTime(checkedAt, "time") })
          : t("notChecked")}
      </Text>
      <Button
        label={actions("checkAgain")}
        icon="refresh"
        variant="secondary"
        loading={health.isFetching}
        onPress={() => void health.refetch()}
      />
    </Card>
  );
}
