import { screen } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";

import { FeaturePlaceholder, placeholderRoute } from "./feature-placeholder";

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({ useNavigation: () => ({ setOptions: mockSetOptions }) }));

describe("FeaturePlaceholder", () => {
  it("shows the route title, a planned status and the canonical path", async () => {
    await renderWithProviders(<FeaturePlaceholder routeId="mobile.camp.weight" />);

    expect(screen.getByRole("header", { name: "Weight" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Planned")).toBeOnTheScreen();
    expect(screen.getByText(/arrives with its feature/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Route: /camp/weight")).toBeOnTheScreen();
    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Weight" });
  });

  it("offers no controls, links or data", async () => {
    await renderWithProviders(<FeaturePlaceholder routeId="mobile.gym.members._member-id" />);

    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(screen.getByLabelText("Route: /gym/members/:memberId")).toBeOnTheScreen();
  });

  it("is localized", async () => {
    await renderWithProviders(<FeaturePlaceholder routeId="mobile.settings" />, {
      storedLocale: "pl",
    });

    expect(screen.getByRole("header", { name: "Ustawienia" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Planowane")).toBeOnTheScreen();
  });

  it("renders as the default export of a route file", async () => {
    const Route = placeholderRoute("mobile.trial");
    await renderWithProviders(<Route />);

    expect(screen.getByTestId("feature-placeholder:mobile.trial")).toBeOnTheScreen();
    expect(Route.displayName).toBe("PlaceholderRoute(mobile.trial)");
  });
});
