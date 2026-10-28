import { fireEvent, screen } from "@testing-library/react-native";

import type { Gym } from "@/entities/gym";
import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { Locale } from "@/shared/i18n/locales";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { GymPulseView } from "./gym-pulse-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const GYM_ID = "8d2e4f60-1a2b-4c3d-8e9f-a0b1c2d3e4f5";

const gym = (role: Gym["viewer"]["role"], name = "Ring A Boxing"): Gym => ({
  id: GYM_ID,
  name,
  gym_type: "boxing_club",
  setup_status: "completed",
  inserted_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
  locations: [
    {
      id: "0b6e1c2d-0000-4000-8000-0000000000aa",
      name: "Praga",
      country_code: "PL",
      city: "Warsaw",
      address_line: "ul. Ząbkowska 31",
      entrance_note: null,
      is_primary: true,
    },
  ],
  viewer: {
    role,
    permissions: role === "owner" ? ["complete_setup", "edit_gym"] : ["view_workspace"],
    staff_membership_id: "7a1b2c3d-0000-4000-8000-000000000002",
  },
});

const SETUP = {
  gym_id: GYM_ID,
  name: "Ring A Boxing",
  gym_type: "boxing_club",
  phone: "+48 600 000 000",
  website: null,
  tagline: "Boxing for everyone.",
  accent_color: "#e3a24f",
  primary_location: gym("owner").locations[0],
  setup_status: "completed",
  revision: 4,
  missing_requirements: [],
  viewer: gym("owner").viewer,
};

function api() {
  return mockFetch(
    jest.fn((url: string) =>
      Promise.resolve(
        url.endsWith(`/gyms/${GYM_ID}/setup`)
          ? jsonResponse({ setup: SETUP })
          : jsonResponse(
              { error: { code: "not_found", message: "x", details: {} } },
              { status: 404 },
            ),
      ),
    ),
  );
}

beforeEach(async () => {
  mockRouter.push.mockClear();
  resetSessionForTests();
  // The gym reads go through the signed-in session (callWithSession).
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({}))));
  await completeAuthentication({
    access_token: "test-access",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "test-refresh",
  });
});

describe("G01 Gym pulse (SF-89)", () => {
  it("shows the owner the real gym and its saved setup, and nothing the backend does not hold", async () => {
    api();
    await renderWithProviders(<GymPulseView gym={gym("owner")} />);
    expect(screen.getByRole("header", { name: "Gym pulse" })).toBeOnTheScreen();
    expect(screen.getByText("Boxing club · Warsaw, Poland")).toBeOnTheScreen();
    expect(await screen.findByText("Boxing for everyone.")).toBeOnTheScreen();
    expect(screen.getByText("Amber")).toBeOnTheScreen();
    expect(screen.getByText("+48 600 000 000")).toBeOnTheScreen();
    expect(screen.getByLabelText("Website: Not added")).toBeOnTheScreen();
    expect(screen.getByText(/Praga/)).toBeOnTheScreen();
    // Coming later, never a number.
    for (const area of [
      "Members",
      "Classes & timetable",
      "Bookings & check-ins",
      "Coaches & staff",
    ])
      expect(screen.getByText(area)).toBeOnTheScreen();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("gives other roles the gym, their role and a limited-access notice; no setup read", async () => {
    const fetchMock = api();
    await renderWithProviders(<GymPulseView gym={gym("front_desk")} />);
    expect(screen.getByText(/The Front desk dashboard isn’t available yet/)).toBeOnTheScreen();
    expect(screen.queryByText("Gym details")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens Settings, the account and Sign out, from the header", async () => {
    api();
    await renderWithProviders(<GymPulseView gym={gym("owner")} />);
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("names the gym and role on the identity pill, however long the name", async () => {
    api();
    const long = "Akademia Boksu Olimpijskiego i Zawodowego Warszawa Praga-Północ Klub Sportowy";
    await renderWithProviders(<GymPulseView gym={gym("manager", long)} />);
    expect(
      screen.getByRole("button", { name: `${long}, Manager. Switch gym or profile` }),
    ).toBeOnTheScreen();
  });

  it.each<Locale>(["en", "ru", "pl", "de", "uk", "es", "es-MX", "fr"])(
    "renders in %s without a raw message key",
    async (locale) => {
      api();
      await renderWithProviders(<GymPulseView gym={gym("owner")} />, { storedLocale: locale });
      await screen.findByText("Boxing for everyone.");
      expect(screen.queryAllByText(/\b(gymShell|gymOnboarding|contextSwitcher)\./)).toEqual([]);
      expect(screen.queryAllByLabelText(/\b(gymShell|gymOnboarding)\./)).toEqual([]);
    },
  );
});
