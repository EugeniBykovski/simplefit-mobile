import { useTranslations } from "use-intl";

import { useTheme, type ThemePreference } from "@/shared/styles/theme";
import { RadioGroup, type RadioOption } from "@/shared/ui/radio-group";

const preferences: readonly ThemePreference[] = ["dark", "light", "system"];

/** Dark (default), light, or follow the device appearance; persisted. */
export function ThemeSelector() {
  const t = useTranslations("theme");
  const { preference, setPreference } = useTheme();

  const options: RadioOption<ThemePreference>[] = preferences.map((value) => ({
    value,
    label: t(value),
  }));

  return (
    <RadioGroup label={t("title")} options={options} value={preference} onChange={setPreference} />
  );
}
