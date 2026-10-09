import { screen, userEvent, waitFor } from "@testing-library/react-native";
import type React from "react";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { FighterOnboardingScreen } from "./fighter-onboarding-screen";

/*
 * The Fighter mobile registration (SF-39, OF1–OF11) on the SF-25
 * FighterProfile, with the network mocked at `fetch`. The backend owns every
 * rule; these check what is sent, what is shown and where the flow goes.
 */

// `?step=` lives in a tiny store so `setParams` re-renders like Expo Router.
const mockParams = {
  current: {} as Record<string, string>,
  listeners: new Set<() => void>(),
  set(next: Record<string, string>) {
    this.current = { ...this.current, ...next };
    this.listeners.forEach((listener) => listener());
  },
};
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => false,
  setParams: (next: Record<string, string>) => mockParams.set(next),
};
const mockRedirects: string[] = [];
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () =>
    jest.requireActual<typeof React>("react").useSyncExternalStore(
      (listener) => {
        mockParams.listeners.add(listener);
        return () => mockParams.listeners.delete(listener);
      },
      () => mockParams.current,
    ),
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: "http://api.test", webUrl: "https://simplefit.test" },
}));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const REQUIRED = ["display_name", "username", "country_code", "city", "experience_level", "stance"];

type Profile = Record<string, unknown>;
const EMPTY: Profile = {
  display_name: null,
  username: null,
  country_code: null,
  city: null,
  experience_level: null,
  amateur_bout_count: null,
  stance: null,
  goals: [],
  next_fight_on: null,
  next_fight_name: null,
  weight_class: null,
  current_weight_kg: null,
  height_cm: null,
};
/** A profile as the backend derives it: missing requirements and status from the fields. */
function profile(fields: Profile = {}, completed = false) {
  const merged = { ...EMPTY, ...fields };
  const missing = REQUIRED.filter((field) => merged[field] === null);
  const started = Object.values(fields).length > 0;
  return {
    fighter_profile: {
      ...merged,
      onboarding: {
        status: completed ? "completed" : started ? "in_progress" : "not_started",
        completed_at: completed ? "2026-10-09T10:00:00Z" : null,
        missing_requirements: missing,
      },
    },
  };
}
const validation = (field_codes: Record<string, string[]>) =>
  jsonResponse(
    { error: { code: "validation_error", message: "x", details: { fields: {}, field_codes } } },
    { status: 422 },
  );

const PROFILE = "/api/v1/me/fighter-profile";
const COMPLETE = "/api/v1/me/fighter-profile/complete-onboarding";

/**
 * A fake SF-25 backend: GET returns the stored fields, PATCH merges the body
 * (or answers with `reject`), complete-onboarding checks the requirements.
 */
function backend(initial: Profile = {}, options: { reject?: () => Response } = {}) {
  let stored: Profile = { ...initial };
  let completed = false;
  const fetchMock = mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      const method = init.method ?? "GET";
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (method === "GET" && pathname === PROFILE)
        return Promise.resolve(jsonResponse(profile(stored, completed)));
      if (method === "PATCH" && pathname === PROFILE) {
        if (options.reject) return Promise.resolve(options.reject());
        stored = { ...stored, ...(JSON.parse(String(init.body)) as Profile) };
        return Promise.resolve(jsonResponse(profile(stored, completed)));
      }
      if (method === "POST" && pathname === COMPLETE) {
        const missing = profile(stored).fighter_profile.onboarding.missing_requirements;
        if (missing.length > 0)
          return Promise.resolve(
            validation(Object.fromEntries(missing.map((field) => [field, ["required"]]))),
          );
        completed = true;
        return Promise.resolve(jsonResponse(profile(stored, true)));
      }
      throw new Error(`unexpected request ${method} ${pathname}`);
    }),
  );
  return {
    fetchMock,
    writes: () =>
      (fetchMock.mock.calls as [string, RequestInit?][])
        .filter(([, init]) => (init?.method ?? "GET") !== "GET")
        .map(([url, init]) => ({
          call: `${init?.method} ${new URL(url).pathname}`,
          body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
        })),
  };
}

const COMPLETE_FIELDS: Profile = {
  display_name: "Alex Rivera",
  username: "alex_r",
  country_code: "PL",
  city: "Kraków",
  experience_level: "amateur",
  stance: "southpaw",
};

const user = userEvent.setup();
const heading = (name: string | RegExp) => screen.findByRole("header", { name });
const press = (name: string | RegExp) => user.press(screen.getByRole("button", { name }));

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
  mockRedirects.length = 0;
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Fighter registration (OF1–OF11)", () => {
  it("starts a new profile on OF1 with the step label, progress and no Skip", async () => {
    backend();
    await renderWithProviders(<FighterOnboardingScreen />);
    expect(await heading("Your fighter profile")).toBeOnTheScreen();
    expect(screen.getByText("Step 1 of 11 · Account")).toBeOnTheScreen();
    expect(screen.getByLabelText("Step 1 of 11")).toHaveAccessibilityValue({
      min: 1,
      max: 11,
      now: 1,
    });
    expect(screen.queryByRole("button", { name: /^Skip/ })).toBeNull();
    // No date of birth or Terms here: O04 owns them.
    expect(screen.queryByLabelText(/Date of birth/)).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Terms/ })).toBeNull();
    await waitFor(() => expect(mockParams.current.step).toBe("account"));
  });

  it("checks OF1's requirements before anything is sent", async () => {
    const api = backend();
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("Your fighter profile");
    await press("Continue");
    expect(await screen.findByText("Enter your name.")).toBeOnTheScreen();
    expect(screen.getByText("Choose your country.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);

    await user.type(screen.getByLabelText("Username"), "-bad-");
    await press("Continue");
    expect(await screen.findByText(/3–30 letters, digits or _/)).toBeOnTheScreen();
  });

  it("saves only OF1's changed fields, with the chosen country code, then shows OF2", async () => {
    const api = backend();
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("Your fighter profile");
    await user.type(screen.getByLabelText("Name"), "Alex Rivera");
    await user.type(screen.getByLabelText("Username"), "@alex_r");
    await user.type(screen.getByLabelText("City"), "Kraków");
    await press("Country");
    await user.type(screen.getByLabelText("Search countries"), "pola");
    await user.press(await screen.findByRole("radio", { name: "Poland" }));
    await press("Continue");

    expect(await heading("Your boxing experience")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      {
        call: `PATCH ${PROFILE}`,
        body: {
          display_name: "Alex Rivera",
          username: "alex_r",
          country_code: "PL",
          city: "Kraków",
        },
      },
    ]);
    expect(mockParams.current.step).toBe("experience");
  });

  it("shows a taken username from the backend's stable code and stays on OF1", async () => {
    backend({}, { reject: () => validation({ username: ["already_exists"] }) });
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("Your fighter profile");
    await user.type(screen.getByLabelText("Name"), "Alex");
    await user.type(screen.getByLabelText("Username"), "taken_name");
    await user.type(screen.getByLabelText("City"), "Kraków");
    await press("Country");
    await user.type(screen.getByLabelText("Search countries"), "pol");
    await user.press(await screen.findByRole("radio", { name: "Poland" }));
    await press("Continue");
    expect(await screen.findByText("That username is taken.")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Your fighter profile" })).toBeOnTheScreen();
  });

  it("resumes at the earliest step with a missing requirement, and no link skips it", async () => {
    backend({ display_name: "Alex", username: "alex", country_code: "PL", city: "Kraków" });
    mockParams.current = { step: "weight" };
    await renderWithProviders(<FighterOnboardingScreen />);
    expect(await heading("Your boxing experience")).toBeOnTheScreen();
    await waitFor(() => expect(mockParams.current.step).toBe("experience"));
  });

  it("asks for the amateur record only with Competitive Amateur, and saves the stance", async () => {
    const api = backend({ display_name: "Alex", username: "alex", country_code: "PL", city: "X" });
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("Your boxing experience");
    expect(screen.queryByLabelText("Amateur bouts")).toBeNull();
    await user.press(screen.getByRole("radio", { name: "Competitive Amateur" }));
    await user.type(screen.getByLabelText("Amateur bouts"), "12");
    await user.press(screen.getByRole("radio", { name: "Southpaw" }));
    await press("Continue");
    expect(await heading("What are you training for?")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      {
        call: `PATCH ${PROFILE}`,
        body: {
          experience_level: "competitive_amateur",
          amateur_bout_count: 12,
          stance: "southpaw",
        },
      },
    ]);
  });

  it("sends the next fight as a calendar date and Skip leaves OF3 unsaved", async () => {
    const api = backend(COMPLETE_FIELDS);
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("What are you training for?");
    await user.press(screen.getByRole("checkbox", { name: "Fight Preparation" }));
    await user.type(screen.getByLabelText("Date"), "03142027");
    await press("Continue");
    expect(await heading("Approximate weight class")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      {
        call: `PATCH ${PROFILE}`,
        body: { goals: ["fight_preparation"], next_fight_on: "2027-03-14" },
      },
    ]);

    await press("Back");
    await heading("What are you training for?");
    await user.press(screen.getByRole("checkbox", { name: "Fitness" }));
    await press("Skip Goals");
    expect(await heading("Approximate weight class")).toBeOnTheScreen();
    expect(api.writes()).toHaveLength(1);
  });

  it("sends the weight as typed: a comma is a point, more decimals reach the API unrounded", async () => {
    const api = backend(COMPLETE_FIELDS, {
      reject: () => validation({ current_weight_kg: ["invalid_format"] }),
    });
    mockParams.current = { step: "weight" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("Approximate weight class");
    expect(screen.getByText(/Weight is private\./)).toBeOnTheScreen();
    await user.press(screen.getByRole("radio", { name: "−71" }));
    await user.type(screen.getByLabelText(/Current weight/), "73,85");
    await press("Continue");
    expect(await screen.findByText(/at most one decimal/)).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      { call: `PATCH ${PROFILE}`, body: { weight_class: "minus_71", current_weight_kg: 73.85 } },
    ]);
    expect(screen.getByRole("header", { name: "Approximate weight class" })).toBeOnTheScreen();
  });

  it("walks the informational steps without recording anything", async () => {
    const api = backend(COMPLETE_FIELDS);
    mockParams.current = { step: "gym" };
    await renderWithProviders(<FighterOnboardingScreen />);
    for (const [title, action] of [
      ["Where do you train?", "Continue"],
      ["Gym membership", "Skip Membership"],
      ["Do you have a coach?", "Continue"],
      ["Your privacy", "Continue"],
      ["Train with people you know", "Continue"],
    ] as const) {
      expect(await heading(title)).toBeOnTheScreen();
      await press(action);
    }
    expect(await heading("What should we tell you?")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);
  });

  it("shows OF11 only after the backend completed onboarding, then continues through the entry", async () => {
    const api = backend({ ...COMPLETE_FIELDS, weight_class: "minus_71" });
    mockParams.current = { step: "notifications" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("What should we tell you?");
    await press("Finish");

    expect(await heading("Your boxing journey starts here.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([{ call: `POST ${COMPLETE}`, body: undefined }]);
    expect(screen.getByText("Alex Rivera")).toBeOnTheScreen();
    expect(screen.getByText("@alex_r")).toBeOnTheScreen();
    expect(screen.getByText("Kraków, Poland")).toBeOnTheScreen();
    expect(screen.getByText("−71")).toBeOnTheScreen();
    expect(mockRedirects).toEqual([]);

    await press("Go to SimpleFit");
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("names a requirement the backend reports at completion and offers its step", async () => {
    // The profile looked complete when loaded; the backend disagrees at completion.
    const api = backend(COMPLETE_FIELDS);
    mockParams.current = { step: "notifications" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("What should we tell you?");
    api.fetchMock.mockImplementationOnce(() =>
      Promise.resolve(validation({ stance: ["required"] })),
    );
    await press("Finish");
    expect(
      await screen.findByText(/Some required details are still missing: Boxing profile/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Your boxing journey starts here." })).toBeNull();
    await press("Go to Boxing profile");
    await waitFor(() => expect(mockParams.current.step).toBe("experience"));
  });

  it("sends an incomplete account registration back through the entry (O04)", async () => {
    const api = backend(COMPLETE_FIELDS);
    mockParams.current = { step: "notifications" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await heading("What should we tell you?");
    api.fetchMock.mockImplementationOnce(() =>
      Promise.resolve(validation({ account_registration: ["required"] })),
    );
    await press("Finish");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("header", { name: "Your boxing journey starts here." })).toBeNull();
  });

  it("leaves a profile completed elsewhere for the entry, even with ?step=complete", async () => {
    const fetchMock = mockFetch(
      jest.fn((url: string) =>
        Promise.resolve(
          jsonResponse(
            new URL(url).pathname === PROFILE ? profile(COMPLETE_FIELDS, true) : { user: VIEWER },
          ),
        ),
      ),
    );
    mockParams.current = { step: "complete" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await waitFor(() => expect(mockRedirects).toContain("/"));
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.queryByRole("header", { name: "Your boxing journey starts here." })).toBeNull();
  });

  it("offers a retry when the profile cannot be loaded, and shows no step", async () => {
    let fail = true;
    mockFetch(
      jest.fn((url: string) => {
        if (new URL(url).pathname === "/api/me")
          return Promise.resolve(jsonResponse({ user: VIEWER }));
        if (fail) return Promise.reject(new TypeError("Network request failed"));
        return Promise.resolve(jsonResponse(profile()));
      }),
    );
    await renderWithProviders(<FighterOnboardingScreen />);
    expect(await screen.findByText(/couldn't load your profile/)).toBeOnTheScreen();
    expect(screen.queryByRole("header")).toBeNull();
    fail = false;
    await press("Try again");
    expect(await heading("Your fighter profile")).toBeOnTheScreen();
  });

  it("leaves OF1 back to the role choice, keeping the intent", async () => {
    backend();
    mockParams.current = { intent: "fighter" };
    await renderWithProviders(<FighterOnboardingScreen />);
    await screen.findByLabelText("Name");
    await press("Back");
    expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding/role?intent=fighter");
  });
});
