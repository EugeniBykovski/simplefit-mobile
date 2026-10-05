import { View } from "react-native";
import { useTranslations } from "use-intl";

import { ApiHealthCard } from "@/features/check-api-health";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

/** Foundation of the future signed-in application area. */
export function AppOverview() {
  const t = useTranslations("appShell");

  return (
    <Screen>
      <View className="gap-2">
        <Text variant="h1">{t("title")}</Text>
        <Text color="mutedForeground">{t("description")}</Text>
      </View>
      <ApiHealthCard />
    </Screen>
  );
}
