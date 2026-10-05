import { useRouter } from "expo-router";
import { View } from "react-native";
import { useFormatter, useNow, useTimeZone, useTranslations } from "use-intl";

import { LanguageSelector } from "@/features/switch-locale";
import { siteConfig } from "@/shared/config/site";
import { useLocaleSettings } from "@/shared/i18n/i18n-provider";
import { localeName } from "@/shared/i18n/locales";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { Separator } from "@/shared/ui/separator";
import { Text } from "@/shared/ui/text";

/** Foundation home: identity, active locale with formatting samples, language choice. */
export function FoundationHome() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const language = useTranslations("language");
  const actions = useTranslations("actions");
  const format = useFormatter();
  const now = useNow();
  const timeZone = useTimeZone();
  const { locale, source } = useLocaleSettings();
  const router = useRouter();

  const samples: [string, string][] = [
    [t("number"), format.number(1234567.891, "decimal")],
    [t("percent"), format.number(0.256, "percent")],
    [t("date"), format.dateTime(now, "date")],
    [t("time"), format.dateTime(now, "time")],
    [t("timeZone"), timeZone ?? "UTC"],
  ];

  return (
    <Screen>
      <View className="gap-2 pt-2">
        <Text variant="caption" color="mutedForeground">
          {t("badge")}
        </Text>
        <Text variant="title">{siteConfig.name}</Text>
        <Text color="mutedForeground">{common("tagline")}</Text>
      </View>

      <Button
        label={actions("openTheApp")}
        icon="arrow-forward"
        onPress={() => router.push("/app")}
      />

      <Card>
        <Text variant="heading">{t("localeTitle")}</Text>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text color="mutedForeground">{t("currentLanguage")}</Text>
          <Text variant="label" lang={locale} testID="current-locale">
            {localeName(locale)} ({locale})
          </Text>
        </View>
        <Text variant="caption" color="mutedForeground">
          {t(`source.${source}`)}
        </Text>
        <Separator />
        {samples.map(([label, value]) => (
          <View
            key={label}
            className="flex-row flex-wrap items-center justify-between gap-3"
            accessible
            accessibilityLabel={`${label}: ${value}`}
          >
            <Text color="mutedForeground">{label}</Text>
            <Text variant="label">{value}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="heading">{language("title")}</Text>
        <LanguageSelector />
      </Card>
    </Screen>
  );
}
