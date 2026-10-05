import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { getPreference } from "@/shared/storage/preferences";
import { renderWithProviders } from "@/test/render";

import { ThemeSelector } from "./theme-selector";

describe("ThemeSelector", () => {
  it("offers dark (selected by default), light and device appearance", async () => {
    await renderWithProviders(<ThemeSelector />);

    expect(screen.getByLabelText("Appearance")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getAllByRole("radio").map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Dark",
      "Light",
      "Match device",
    ]);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("switches and persists the theme, translated", async () => {
    await renderWithProviders(<ThemeSelector />, { storedLocale: "pl" });
    await userEvent.press(screen.getByRole("radio", { name: "Jasny" }));

    expect(screen.getByRole("radio", { name: "Jasny" })).toBeChecked();
    await waitFor(async () => expect(await getPreference("theme")).toBe("light"));
  });
});
