import { act, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useTranslations } from "use-intl";

import { getPreference } from "@/shared/storage/preferences";
import { renderWithProviders } from "@/test/render";

import { useLocaleSettings } from "./i18n-provider";

function Probe() {
  const t = useTranslations("navigation");
  const { locale, source, deviceLocale, setLocale } = useLocaleSettings();
  return (
    <>
      <Text testID="state">{`${locale}|${source}|${deviceLocale}|${t("home")}`}</Text>
      <Text testID="choose-uk" onPress={() => void setLocale("uk")}>
        uk
      </Text>
      <Text testID="follow-device" onPress={() => void setLocale(null)}>
        device
      </Text>
    </>
  );
}

describe("I18nProvider", () => {
  it("follows the device language without an explicit choice", async () => {
    await renderWithProviders(<Probe />, {
      deviceLocales: [{ languageTag: "de-DE", languageCode: "de" }],
    });
    expect(screen.getByTestId("state")).toHaveTextContent("de|device|de|Start");
  });

  it("restores a persisted explicit choice over the device language", async () => {
    await renderWithProviders(<Probe />, {
      deviceLocales: [{ languageTag: "de-DE", languageCode: "de" }],
      storedLocale: "es-MX",
    });
    expect(screen.getByTestId("state")).toHaveTextContent("es-MX|explicit|de|Inicio");
  });

  it("persists an explicit choice and can return to the device language", async () => {
    await renderWithProviders(<Probe />, {
      deviceLocales: [{ languageTag: "fr-FR", languageCode: "fr" }],
    });

    await act(async () => screen.getByTestId("choose-uk").props.onPress());
    expect(screen.getByTestId("state")).toHaveTextContent("uk|explicit|fr|Головна");
    expect(await getPreference("locale")).toBe("uk");

    await act(async () => screen.getByTestId("follow-device").props.onPress());
    expect(screen.getByTestId("state")).toHaveTextContent("fr|device|fr|Accueil");
    expect(await getPreference("locale")).toBeNull();
  });
});
