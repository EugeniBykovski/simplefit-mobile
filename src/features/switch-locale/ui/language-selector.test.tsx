import { screen, userEvent } from "@testing-library/react-native";

import { getPreference } from "@/shared/storage/preferences";
import { renderWithProviders } from "@/test/render";

import { LanguageSelector } from "./language-selector";

describe("LanguageSelector", () => {
  it("offers the device language and all 8 locales by native name", async () => {
    await renderWithProviders(<LanguageSelector />, {
      deviceLocales: [{ languageTag: "pl-PL", languageCode: "pl" }],
    });

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Język urządzenia, Obecnie: Polski",
      "English",
      "Русский",
      "Polski",
      "Deutsch",
      "Українська",
      "Español",
      "Español (México)",
      "Français",
    ]);
    expect(screen.getByLabelText("Język")).toHaveProp("accessibilityRole", "radiogroup");
    expect(radios[0]).toBeChecked();
  });

  it("switches to an explicit locale, persists it and re-renders translated", async () => {
    await renderWithProviders(<LanguageSelector />);

    await userEvent.press(screen.getByRole("radio", { name: "Español (México)" }));

    expect(screen.getByLabelText("Idioma")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "Español (México)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Español" })).not.toBeChecked();
    expect(await getPreference("locale")).toBe("es-MX");
  });

  it("returns to following the device", async () => {
    await renderWithProviders(<LanguageSelector />, {
      storedLocale: "fr",
      deviceLocales: [{ languageTag: "de-DE", languageCode: "de" }],
    });

    await userEvent.press(
      screen.getByRole("radio", { name: "Langue de l’appareil, Actuellement : Deutsch" }),
    );

    expect(screen.getByLabelText("Sprache")).toHaveProp("accessibilityRole", "radiogroup");
    expect(await getPreference("locale")).toBeNull();
  });
});
