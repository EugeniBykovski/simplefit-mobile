import { screen, userEvent } from "@testing-library/react-native";
import type * as ReactNative from "react-native";

import { ApiError } from "@/shared/api/http/api-error";
import { renderWithProviders } from "@/test/render";

import { FailureView } from "./failure-view";
import { LaunchScreen } from "./launch-screen";
import { NotFoundState } from "./not-found-state";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/sessions/8812",
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual<typeof ReactNative>("react-native");
    return <Text testID="redirect">{href}</Text>;
  },
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "0.1.0" } }));
// The launch motion rests static under Reduce Motion (also keeps the tests deterministic).
jest.mock("@/shared/lib/reduced-motion", () => ({ useReducedMotion: () => true }));

beforeEach(() => jest.clearAllMocks());

describe("NotFoundState (ER1)", () => {
  it("leads home to the entry route, never to fighter-only /home", async () => {
    await renderWithProviders(<NotFoundState frozen />);
    expect(
      screen.getByRole("header", { name: "This page is down for the count." }),
    ).toBeOnTheScreen();
    expect(screen.getByText("/sessions/8812 · not found")).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Back home" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    await userEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.replace).toHaveBeenCalledTimes(2);
  });

  it("opens help and reports a broken link through registry routes", async () => {
    await renderWithProviders(<NotFoundState frozen />);
    await userEvent.press(screen.getByRole("button", { name: "Help" }));
    await userEvent.press(screen.getByRole("link", { name: "Report a broken link" }));
    expect(mockRouter.push.mock.calls).toEqual([["/settings/help"], ["/settings/help"]]);
  });

  it("is saved by the bell, then offers its corner and search", async () => {
    await renderWithProviders(<NotFoundState frozen />);
    await userEvent.press(screen.getByRole("button", { name: "Beat the count" }));
    expect(screen.getByRole("header", { name: "Saved by the bell." })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Search" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/search");
  });

  it("counts again after a knockout", async () => {
    await renderWithProviders(<NotFoundState initialPhase="ko" frozen />);
    expect(screen.getByRole("header", { name: "KO. This page didn’t get up." })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Count again" }));
    expect(
      screen.getByRole("header", { name: "This page is down for the count." }),
    ).toBeOnTheScreen();
  });
});

describe("LaunchScreen (LD1)", () => {
  it("is a labelled busy state that shows only real runtime facts", async () => {
    await renderWithProviders(<LaunchScreen />);
    expect(screen.getByLabelText("Loading SimpleFit")).toBeOnTheScreen();
    expect(screen.getByText("v0.1.0")).toBeOnTheScreen();
    expect(screen.queryByText(/EU-CENTRAL|OFFLINE-READY|ROUND/i)).toBeNull();
  });
});

describe("FailureView", () => {
  it("never shows the error's message or details", async () => {
    await renderWithProviders(
      <FailureView error={new Error("db password=hunter2 sfr_secret")} onRetry={() => {}} />,
    );
    expect(screen.getByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.queryByText(/hunter2|sfr_secret/)).toBeNull();
  });

  it("offers a retry when offline and home when forbidden", async () => {
    const retry = jest.fn();
    await renderWithProviders(
      <FailureView
        error={new ApiError("network", 0, "network_error", "x", {}, null)}
        onRetry={retry}
      />,
    );
    await userEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });

  it("returns a 401 to sign-in with returnTo instead of a screen", async () => {
    await renderWithProviders(
      <FailureView error={new ApiError("http", 401, "unauthorized", "x", {}, "req")} />,
    );
    expect(screen.getByTestId("redirect")).toHaveTextContent("/login?returnTo=%2Fsessions%2F8812");
  });
});
