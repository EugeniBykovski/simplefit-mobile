import { Stack, useRouter } from "expo-router";
import { useTranslations } from "use-intl";

import { Button } from "@/shared/ui/button";
import { Screen } from "@/shared/ui/screen";
import { Text } from "@/shared/ui/text";

/** Unknown routes, including unrecognised deep links. */
export default function NotFoundRoute() {
  const t = useTranslations("errors.notFound");
  const actions = useTranslations("actions");
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: t("title") }} />
      <Text variant="h2">{t("title")}</Text>
      <Text color="mutedForeground">{t("description")}</Text>
      <Button
        label={actions("backToHome")}
        variant="secondary"
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}
