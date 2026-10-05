import { screen, userEvent } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";

import { FoundationHome } from "./foundation-home";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

describe("FoundationHome", () => {
  it("identifies SimpleFit Boxing and shows the active locale with samples", async () => {
    await renderWithProviders(<FoundationHome />, {
      deviceLocales: [{ languageTag: "de-DE", languageCode: "de" }],
    });

    expect(screen.getByRole("header", { name: "SimpleFit Boxing" })).toBeOnTheScreen();
    expect(screen.getByTestId("current-locale")).toHaveTextContent("Deutsch (de)");
    expect(screen.getByText("Folgt den Geräteeinstellungen")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Zahl: 1\.234\.567,89$/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Zeitzone: UTC")).toBeOnTheScreen();
  });

  it("navigates to the application shell", async () => {
    await renderWithProviders(<FoundationHome />);
    await userEvent.press(screen.getByRole("button", { name: "Open the app" }));
    expect(mockPush).toHaveBeenCalledWith("/app");
  });

  it("switches language live from the selector", async () => {
    await renderWithProviders(<FoundationHome />);
    await userEvent.press(screen.getByRole("radio", { name: "Українська" }));

    expect(screen.getByTestId("current-locale")).toHaveTextContent("Українська (uk)");
    expect(screen.getByRole("button", { name: "Відкрити застосунок" })).toBeOnTheScreen();
    expect(screen.getByText("Вибрано в застосунку")).toBeOnTheScreen();
  });
});
