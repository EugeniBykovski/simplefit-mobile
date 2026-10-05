import { useTranslations } from "use-intl";

import { useLocaleSettings } from "@/shared/i18n/i18n-provider";
import { localeName, locales, type Locale } from "@/shared/i18n/locales";
import { RadioGroup, type RadioOption } from "@/shared/ui/radio-group";

const DEVICE = "device";

/**
 * Lets the user follow the device language or pick one explicitly. An explicit
 * choice is persisted and overrides the device. Languages are listed by their
 * native names, without flags.
 */
export function LanguageSelector() {
  const t = useTranslations("language");
  const { locale, source, deviceLocale, setLocale } = useLocaleSettings();

  const options: RadioOption<Locale | typeof DEVICE>[] = [
    {
      value: DEVICE,
      label: t("device"),
      description: t("deviceHint", { language: localeName(deviceLocale) }),
    },
    ...locales.map((option) => ({ value: option, label: localeName(option), lang: option })),
  ];

  return (
    <RadioGroup
      label={t("title")}
      options={options}
      value={source === "device" ? DEVICE : locale}
      onChange={(value) => void setLocale(value === DEVICE ? null : value)}
    />
  );
}
