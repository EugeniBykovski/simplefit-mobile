import { screen, userEvent } from "@testing-library/react-native";

import { renderWithProviders } from "@/test/render";

import { LoginScreen, WelcomeScreen } from "./auth-screens";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));

describe("auth screens", () => {
  it("welcomes new members with Google and links to sign-in", async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByRole("header", { name: "Join the boxing community." })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Continue with Apple" })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("signs members in with Google and links back to joining", async () => {
    await renderWithProviders(<LoginScreen />, { storedLocale: "fr" });

    expect(screen.getByRole("header", { name: "Bon retour" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continuer avec Google" })).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Continuer avec Apple" })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("link", { name: "Rejoindre la communauté de la boxe" }));
    expect(mockPush).toHaveBeenCalledWith("/welcome");
  });
});
