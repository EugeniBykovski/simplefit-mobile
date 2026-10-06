import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useFormatter, useNow, useTimeZone, useTranslations } from "use-intl";

import { SessionControl } from "@/features/sign-out";
import { LanguageSelector } from "@/features/switch-locale";
import { ThemeSelector } from "@/features/switch-theme";
import { siteConfig } from "@/shared/config/site";
import { useLocaleSettings } from "@/shared/i18n/i18n-provider";
import { localeName } from "@/shared/i18n/locales";
import { routeHref } from "@/shared/routes/routes";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { Separator } from "@/shared/ui/separator";
import { Text } from "@/shared/ui/text";

/** Foundation home: identity, active locale with formatting samples, language and theme choice. */
export function FoundationHome() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const language = useTranslations("language");
  const theme = useTranslations("theme");
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
        <Text variant="label" color="primary">
          {t("badge")}
        </Text>
        <Text variant="h1">{siteConfig.name}</Text>
        <Text color="mutedForeground">{common("tagline")}</Text>
      </View>

      <Button
        label={actions("openTheApp")}
        icon={ArrowRight}
        size="lg"
        onPress={() => router.push(routeHref("mobile.app"))}
      />

      <SessionControl />

      <Card>
        <Text variant="h3">{t("localeTitle")}</Text>
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text color="mutedForeground">{t("currentLanguage")}</Text>
          <Text weight="bold" lang={locale} testID="current-locale">
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
            <Text weight="bold">{value}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="h3">{language("title")}</Text>
        <LanguageSelector />
      </Card>

      <Card>
        <Text variant="h3">{theme("title")}</Text>
        <ThemeSelector />
      </Card>

      {__DEV__ ? (
        // Developer-only entry point (stripped from production bundles), so
        // it is intentionally not translated.
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(routeHref("mobile.dev.design-system"))}
          className="min-h-touch items-center justify-center self-center px-3"
        >
          <Text variant="label" color="mutedForeground">
            Design system gallery
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
