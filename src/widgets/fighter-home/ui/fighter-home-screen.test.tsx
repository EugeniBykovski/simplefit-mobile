import { screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { FighterHomeScreen } from "./fighter-home-screen";

/*
 * The Fighter home (SF-41, FR4 + FR5 tour) on the SF-25 profile and the
 * SF-40 first-run API, with the network mocked at `fetch`.
 */

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockRedirects: string[] = [];
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const PROFILE = {
  display_name: "Alex Rivera",
  username: "alex",
  country_code: "PL",
  city: "Kraków",
  experience_level: "amateur",
  amateur_bout_count: null,
  stance: "orthodox",
  goals: [],
  next_fight_on: null,
  next_fight_name: null,
  weight_class: null,
  current_weight_kg: null,
  height_cm: null,
  onboarding: {
    status: "completed",
    completed_at: new Date().toISOString(),
    missing_requirements: [],
  },
};

function backend(mobile: string) {
  return mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      if ((init.method ?? "GET") !== "GET") throw new Error(`unexpected write ${pathname}`);
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (pathname === "/api/v1/me/fighter-profile")
        return Promise.resolve(jsonResponse({ fighter_profile: PROFILE }));
      if (pathname === "/api/v1/me/first-run")
        return Promise.resolve(
          jsonResponse({
            experiences: [
              { experience: "fighter_web_tour", status: "completed", recorded_at: null },
              { experience: "fighter_mobile_first_run", status: mobile, recorded_at: null },
            ],
          }),
        );
      throw new Error(`unexpected request ${pathname}`);
    }),
  );
}

const user = userEvent.setup();

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.push.mockClear();
  mockRedirects.length = 0;
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Fighter home (FR4)", () => {
  it("opens the introduction while the mobile first run is pending (the web tour does not count)", async () => {
    backend("pending");
    await renderWithProviders(<FighterHomeScreen />);
    await waitFor(() => expect(mockRedirects).toContain("/welcome/tour"));
  });

  it("sends a Fighter without completed onboarding to the entry", async () => {
    backend("unavailable");
    await renderWithProviders(<FighterHomeScreen />);
    await waitFor(() => expect(mockRedirects).toContain("/"));
  });

  it.each(["completed", "dismissed"])(
    "shows the home after the introduction was %s, with only real data",
    async (status) => {
      backend(status);
      await renderWithProviders(<FighterHomeScreen />);
      expect(
        await screen.findByRole("header", { name: /Welcome in, Alex Rivera\./ }),
      ).toBeOnTheScreen();
      expect(screen.getByText(/· Day 1$/)).toBeOnTheScreen();
      expect(screen.getByLabelText("Alex Rivera, Fighter")).toBeOnTheScreen();
      // Every checklist step belongs to a domain that does not exist yet.
      expect(screen.getAllByText("Not available yet")).toHaveLength(5);
      expect(screen.getByLabelText("0 of 5 done")).toBeOnTheScreen();
      expect(screen.getByText("Empty")).toBeOnTheScreen();
      expect(mockRedirects).toEqual([]);
    },
  );

  it("opens Notifications from the bell", async () => {
    backend("completed");
    await renderWithProviders(<FighterHomeScreen />);
    await user.press(await screen.findByRole("button", { name: "Notifications" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/notifications");
  });
});

describe("Fighter home tour (FR5)", () => {
  it("walks seven steps with Back, finishes on the completion card and records nothing", async () => {
    const fetchMock = backend("completed");
    await renderWithProviders(<FighterHomeScreen />);
    await user.press(await screen.findByRole("button", { name: "Help and tour" }));

    const titles = [
      "Start here",
      "This is your Live Board",
      "Train and log",
      "Your people",
      "Profile and settings",
      "Only what matters",
      "Your roles",
    ];
    for (const [index, title] of titles.entries()) {
      expect(await screen.findByRole("header", { name: title })).toBeOnTheScreen();
      expect(screen.getByText(`Tour · ${index + 1} of 7`)).toBeOnTheScreen();
      if (index === 1) {
        await user.press(screen.getByRole("button", { name: "Back" }));
        expect(await screen.findByRole("header", { name: "Start here" })).toBeOnTheScreen();
        await user.press(screen.getByRole("button", { name: "Next" }));
        await screen.findByRole("header", { name: title });
      }
      await user.press(screen.getByRole("button", { name: index === 6 ? "Finish" : "Next" }));
    }
    expect(
      await screen.findByRole("header", { name: "You know your way around" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Tour complete")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Back to my checklist" }));
    await waitFor(() =>
      expect(screen.queryByRole("header", { name: "You know your way around" })).toBeNull(),
    );

    const writes = (fetchMock.mock.calls as [string, RequestInit?][]).filter(
      ([, init]) => (init?.method ?? "GET") !== "GET",
    );
    expect(writes).toEqual([]);
  });

  it("ends from any step with “End tour”, and replays from the Live Board card", async () => {
    backend("completed");
    await renderWithProviders(<FighterHomeScreen />);
    await user.press(await screen.findByRole("button", { name: "Take the 1-minute tour" }));
    expect(await screen.findByRole("header", { name: "Start here" })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(await screen.findByRole("button", { name: "End tour" }));
    await waitFor(() => expect(screen.queryByRole("header", { name: /Live Board$/ })).toBeNull());

    // A replay starts again at step 1.
    await user.press(screen.getByRole("button", { name: "Help and tour" }));
    const card = await screen.findByRole("header", { name: "Start here" });
    expect(
      within(screen.getByText("Tour · 1 of 7").parent!.parent!).queryByText("Back"),
    ).toBeNull();
    expect(card).toBeOnTheScreen();
  });
});
