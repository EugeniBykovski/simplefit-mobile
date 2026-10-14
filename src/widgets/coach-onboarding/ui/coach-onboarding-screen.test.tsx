import { act, fireEvent, screen, userEvent, waitFor } from "@testing-library/react-native";
import type React from "react";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { CoachOnboardingScreen } from "./coach-onboarding-screen";

/*
 * The Coach mobile registration (SF-53, OC1 → OC2 → OC11) on the SF-50
 * CoachProfile and the SF-51 entry, with the network mocked at `fetch`. The
 * backend owns every rule; these check what is sent, what is shown and where
 * the flow goes.
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
  Stack: { Screen: () => null },
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: "http://api.test", webUrl: "https://simplefit.test" },
}));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };

type Profile = Record<string, unknown>;
const EMPTY: Profile = {
  display_name: null,
  brand_name: null,
  country_code: null,
  city: null,
  bio: null,
  languages: [],
  coaching_formats: [],
  competition_levels: [],
};
/** A profile as the backend derives it: missing requirements and status from the fields. */
function profile(fields: Profile = {}, completed = false) {
  const merged = { ...EMPTY, ...fields };
  const missing = [
    ...["display_name", "country_code", "city"].filter((field) => merged[field] === null),
    ...((merged.coaching_formats as unknown[]).length === 0 ? ["coaching_formats"] : []),
  ];
  const started = Object.values(fields).length > 0;
  return {
    coach_profile: {
      ...merged,
      onboarding: {
        status: completed ? "completed" : started ? "in_progress" : "not_started",
        completed_at: completed ? "2026-10-14T10:00:00Z" : null,
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

const PROFILE = "/api/v1/me/coach-profile";
const COMPLETE = "/api/v1/me/coach-profile/complete-onboarding";
const ACCOUNT = "/api/v1/me/account-profile";
const CONTEXT = "/api/v1/me/entry/context";

const account = (full_name: string | null) => ({
  account_profile: {
    full_name,
    date_of_birth: "1990-01-01",
    product_news: false,
    consents: [],
    registration: {
      status: "completed",
      completed_at: "2026-10-01T10:00:00Z",
      missing_requirements: [],
    },
  },
});

/**
 * A fake SF-50 / SF-51 backend: GET returns the stored fields, PATCH merges
 * the body (or answers with `reject`), complete-onboarding checks the
 * requirements, and the context choice answers 204 (or `contextFails`).
 */
function backend(
  initial: Profile = {},
  options: {
    reject?: () => Response;
    loseCompletionResponse?: boolean;
    fullName?: string | null;
    contextFails?: number;
  } = {},
) {
  let stored: Profile = { ...initial };
  let completed = false;
  let contextFails = options.contextFails ?? 0;
  const fetchMock = mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      const method = init.method ?? "GET";
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (method === "GET" && pathname === ACCOUNT)
        return Promise.resolve(jsonResponse(account(options.fullName ?? null)));
      if (method === "GET" && pathname === PROFILE)
        return Promise.resolve(jsonResponse(profile(stored, completed)));
      if (method === "PATCH" && pathname === PROFILE) {
        if (options.reject) return Promise.resolve(options.reject());
        stored = { ...stored, ...(JSON.parse(String(init.body)) as Profile) };
        return Promise.resolve(jsonResponse(profile(stored, completed)));
      }
      if (method === "POST" && pathname === COMPLETE) {
        const missing = profile(stored).coach_profile.onboarding.missing_requirements;
        if (missing.length > 0)
          return Promise.resolve(
            validation(Object.fromEntries(missing.map((field) => [field, ["required"]]))),
          );
        completed = true;
        if (options.loseCompletionResponse === true) {
          options.loseCompletionResponse = false;
          return Promise.reject(new TypeError("Network request failed"));
        }
        return Promise.resolve(jsonResponse(profile(stored, true)));
      }
      if (method === "PUT" && pathname === CONTEXT) {
        if (contextFails > 0) {
          contextFails -= 1;
          return Promise.reject(new TypeError("Network request failed"));
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`unexpected request ${method} ${pathname}`);
    }),
  );
  const calls = () =>
    (fetchMock.mock.calls as [string, RequestInit?][]).map(([url, init]) => ({
      call: `${init?.method ?? "GET"} ${new URL(url).pathname}`,
      body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    }));
  return {
    fetchMock,
    editElsewhere: (fields: Profile) => {
      stored = { ...stored, ...fields };
    },
    completeElsewhere: () => {
      completed = true;
    },
    calls,
    writes: () => calls().filter(({ call }) => !call.startsWith("GET ")),
  };
}

const PROFILE_FIELDS: Profile = {
  display_name: "Coach Sam",
  country_code: "PL",
  city: "Kraków",
};

const user = userEvent.setup();
const heading = (name: string | RegExp) => screen.findByRole("header", { name });
const press = (name: string | RegExp) => user.press(screen.getByRole("button", { name }));
const chooseCountry = async (search: string, name: string) => {
  await press("Country");
  await user.type(screen.getByLabelText("Search countries"), search);
  await user.press(await screen.findByRole("radio", { name }));
};

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

describe("Coach registration (OC1, OC2, OC11)", () => {
  it("starts a new profile on OC1 with two steps and the account name as an editable suggestion", async () => {
    const api = backend({}, { fullName: "Alex Novak" });
    await renderWithProviders(<CoachOnboardingScreen />);
    expect(await heading("Your coach profile")).toBeOnTheScreen();
    expect(screen.getByText("Step 1 of 2 · Coach profile")).toBeOnTheScreen();
    expect(screen.getByLabelText("Step 1 of 2")).toHaveAccessibilityValue({
      min: 1,
      max: 2,
      now: 1,
    });
    expect(await screen.findByDisplayValue("Alex Novak")).toBeOnTheScreen();
    expect(screen.getByText(/Suggested from your account name/)).toBeOnTheScreen();
    // Nothing is created by reading, and no FUTURE domain is asked for.
    expect(api.writes()).toEqual([]);
    expect(screen.queryByText(/Years coaching|Credentials|Gym|Plan|Payouts/)).toBeNull();
    await waitFor(() => expect(mockParams.current.step).toBe("profile"));
  });

  it("checks OC1's requirements before anything is sent", async () => {
    const api = backend();
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("Your coach profile");
    await press("Continue");
    expect(await screen.findByText("Enter your coach name.")).toBeOnTheScreen();
    expect(screen.getByText("Select your country.")).toBeOnTheScreen();
    expect(screen.getByText("Enter your city.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);
  });

  it("checks lengths as the API counts them (code points) and sends nothing too long", async () => {
    const api = backend(PROFILE_FIELDS);
    mockParams.current = { step: "profile" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Coach Sam");
    fireEvent.changeText(screen.getByLabelText("Coach name"), "x".repeat(61));
    await press("Continue");
    expect(await screen.findByText("That’s too long.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);

    // 31 boxing gloves are 62 UTF-16 units but 31 characters: within the limit.
    fireEvent.changeText(screen.getByLabelText("Coach name"), "🥊".repeat(31));
    await press("Continue");
    expect(await heading("How do you coach?")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      { call: `PATCH ${PROFILE}`, body: { display_name: "🥊".repeat(31) } },
    ]);
  });

  it("saves only OC1's changed fields, the suggestion included, in contract order, then shows OC2", async () => {
    const api = backend({}, { fullName: "Alex Novak" });
    await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Alex Novak");
    await chooseCountry("pola", "Poland");
    await user.type(screen.getByLabelText("City"), " Warsaw ");
    await user.press(screen.getByRole("checkbox", { name: "Polski" }));
    await user.press(screen.getByRole("checkbox", { name: "English" }));
    await press("Continue");

    expect(await heading("How do you coach?")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      {
        call: `PATCH ${PROFILE}`,
        body: {
          display_name: "Alex Novak",
          country_code: "PL",
          city: "Warsaw",
          languages: ["en", "pl"],
        },
      },
    ]);
    // The account is only read, never written.
    expect(api.calls().filter(({ call }) => call.includes("account-profile"))).toEqual([
      { call: `GET ${ACCOUNT}`, body: undefined },
    ]);
    expect(mockParams.current.step).toBe("type");
  });

  it("never replaces a saved coach name with the account name, and does not read the account", async () => {
    const api = backend(PROFILE_FIELDS, { fullName: "Alex Novak" });
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    await press("Back");
    expect(await screen.findByDisplayValue("Coach Sam")).toBeOnTheScreen();
    expect(screen.queryByDisplayValue("Alex Novak")).toBeNull();
    expect(screen.queryByText(/Suggested from your account name/)).toBeNull();
    expect(api.calls().some(({ call }) => call.includes("account-profile"))).toBe(false);
  });

  it("drops the untouched suggestion when a coach name is saved on another client", async () => {
    const api = backend({}, { fullName: "Alex Novak" });
    const { queryClient } = await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Alex Novak");
    api.editElsewhere({ display_name: "Coach Sam" });
    await act(() => queryClient.refetchQueries());
    expect(await screen.findByDisplayValue("Coach Sam")).toBeOnTheScreen();
    expect(screen.queryByText(/Suggested from your account name/)).toBeNull();
  });

  it("clears optional fields with null and an emptied list with []", async () => {
    const api = backend({
      ...PROFILE_FIELDS,
      brand_name: "Sam Boxing",
      bio: "Footwork first.",
      languages: ["pl"],
    });
    mockParams.current = { step: "profile" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Sam Boxing");
    await user.clear(screen.getByLabelText("Brand name · optional"));
    await user.clear(screen.getByLabelText("Bio · optional"));
    await user.press(screen.getByRole("checkbox", { name: "Polski" }));
    await press("Continue");
    await heading("How do you coach?");
    expect(api.writes()).toEqual([
      { call: `PATCH ${PROFILE}`, body: { brand_name: null, bio: null, languages: [] } },
    ]);
  });

  it("maps the backend's stable codes to the field and stays on OC1", async () => {
    backend(PROFILE_FIELDS, { reject: () => validation({ city: ["too_long"] }) });
    mockParams.current = { step: "profile" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Kraków");
    await user.type(screen.getByLabelText("City"), "x");
    await press("Continue");
    expect(await screen.findByText("That’s too long.")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Your coach profile" })).toBeOnTheScreen();
  });

  it("keeps the values typed and offers a retry when a save fails", async () => {
    const api = backend(PROFILE_FIELDS);
    mockParams.current = { step: "profile" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Kraków");
    await user.type(screen.getByLabelText("Brand name · optional"), "Sam Boxing");
    api.fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("offline")));
    await press("Continue");
    expect(await screen.findByText(/couldn’t save your changes/)).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Sam Boxing")).toBeOnTheScreen();
    await press("Continue");
    expect(await heading("How do you coach?")).toBeOnTheScreen();
  });

  it("asks for a coaching format before finishing, keeping formats and levels separate", async () => {
    const api = backend(PROFILE_FIELDS);
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    expect(screen.getByText("Step 2 of 2 · Coaching type")).toBeOnTheScreen();
    // The approved vocabularies only: four formats, two competition levels.
    for (const name of ["Personal Training", "Group Coaching", "Online Coaching", "Fight Camps"])
      expect(screen.getByRole("checkbox", { name })).toBeOnTheScreen();
    for (const name of ["Amateur", "Professional"])
      expect(screen.getByRole("checkbox", { name })).toBeOnTheScreen();
    expect(screen.queryByText(/Strength|Youth|Women/)).toBeNull();
    await press("Finish");
    expect(await screen.findByText("Pick at least one format.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);
  });

  it("shows OC11 only after the backend completed, then records the Coach context and asks the entry", async () => {
    const api = backend(PROFILE_FIELDS);
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    await user.press(screen.getByRole("checkbox", { name: "Fight Camps" }));
    await user.press(screen.getByRole("checkbox", { name: "Personal Training" }));
    await user.press(screen.getByRole("checkbox", { name: "Amateur" }));
    await press("Finish");

    expect(await heading("Your coach profile is ready.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([
      {
        call: `PATCH ${PROFILE}`,
        body: {
          coaching_formats: ["personal_training", "fight_camps"],
          competition_levels: ["amateur"],
        },
      },
      { call: `POST ${COMPLETE}`, body: undefined },
    ]);
    expect(screen.getByText("Coach Sam")).toBeOnTheScreen();
    expect(screen.getByText("Kraków, Poland")).toBeOnTheScreen();
    expect(screen.getByText("Personal Training · Fight Camps")).toBeOnTheScreen();
    expect(screen.getByText(/Coach tools are not available yet/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(mockRedirects).toEqual([]);

    await press("Continue to coach home");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/?intent=coach"));
    expect(api.writes().at(-1)).toEqual({ call: `PUT ${CONTEXT}`, body: { context: "coach" } });
  });

  it("stays on OC11 with Try again when the context choice fails", async () => {
    backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] }, { contextFails: 1 });
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    await press("Finish");
    await heading("Your coach profile is ready.");
    await press("Continue to coach home");
    expect(await screen.findByText(/couldn’t open your coach home/)).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await press("Try again");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/?intent=coach"));
  });

  it("names a coach-profile requirement the backend reports at completion and offers OC1", async () => {
    const api = backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] });
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    api.fetchMock.mockImplementationOnce(() => Promise.resolve(validation({ city: ["required"] })));
    await press("Finish");
    expect(await screen.findByText(/Add your city to finish/)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Your coach profile is ready." })).toBeNull();
    await press("Go to Coach profile");
    await waitFor(() => expect(mockParams.current.step).toBe("profile"));
  });

  it("sends an incomplete account registration back through the entry, keeping the Coach intent", async () => {
    const api = backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] });
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    api.fetchMock.mockImplementationOnce(() =>
      Promise.resolve(validation({ account_registration: ["required"] })),
    );
    await press("Finish");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/?intent=coach"));
    expect(screen.queryByRole("header", { name: "Your coach profile is ready." })).toBeNull();
  });

  it("resolves a FUTURE or stale step link to the resume step", async () => {
    backend({ display_name: "Coach Sam" });
    mockParams.current = { step: "credentials" };
    await renderWithProviders(<CoachOnboardingScreen />);
    expect(await heading("Your coach profile")).toBeOnTheScreen();
    await waitFor(() => expect(mockParams.current.step).toBe("profile"));
  });

  it("never shows OC11 for an unfinished profile, even with ?step=complete", async () => {
    backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] });
    mockParams.current = { step: "complete" };
    await renderWithProviders(<CoachOnboardingScreen />);
    expect(await heading("How do you coach?")).toBeOnTheScreen();
    await waitFor(() => expect(mockParams.current.step).toBe("type"));
  });

  it("leaves a profile completed elsewhere for the entry with the Coach intent", async () => {
    const api = backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] });
    api.completeElsewhere();
    mockParams.current = { step: "complete" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await waitFor(() => expect(mockRedirects).toContain("/?intent=coach"));
    expect(screen.queryByRole("header", { name: "Your coach profile is ready." })).toBeNull();
    expect(api.writes()).toEqual([]);
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
    await renderWithProviders(<CoachOnboardingScreen />);
    expect(await screen.findByText(/couldn’t load your coach profile/)).toBeOnTheScreen();
    expect(screen.queryByRole("header")).toBeNull();
    fail = false;
    await press("Try again");
    expect(await heading("Your coach profile")).toBeOnTheScreen();
  });

  it("leaves OC1 back to the role choice, keeping the intent", async () => {
    backend();
    mockParams.current = { intent: "coach" };
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("Your coach profile");
    await press("Back");
    expect(mockRouter.replace).toHaveBeenCalledWith("/onboarding/role?intent=coach");
  });
});

describe("Coach onboarding lifecycle", () => {
  it("resumes on OC2 once only the coaching format is missing", async () => {
    backend(PROFILE_FIELDS);
    await renderWithProviders(<CoachOnboardingScreen />);
    expect(await heading("How do you coach?")).toBeOnTheScreen();
    await waitFor(() => expect(mockParams.current.step).toBe("type"));
  });

  it("leaves for the entry when another client completes onboarding meanwhile", async () => {
    const api = backend({ ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] });
    const { queryClient } = await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    api.completeElsewhere();
    await act(() => queryClient.refetchQueries());
    await waitFor(() => expect(mockRedirects).toContain("/?intent=coach"));
    expect(api.writes()).toEqual([]);
  });

  it("keeps an unsaved edit over another client's refetched change, and saves only the edit", async () => {
    const api = backend(PROFILE_FIELDS);
    mockParams.current = { step: "profile" };
    const { queryClient } = await renderWithProviders(<CoachOnboardingScreen />);
    await screen.findByDisplayValue("Kraków");
    await user.type(screen.getByLabelText("Brand name · optional"), "Sam Boxing");
    api.editElsewhere({ city: "Gdańsk" });
    await act(() => queryClient.refetchQueries());

    expect(await screen.findByDisplayValue("Gdańsk")).toBeOnTheScreen();
    expect(screen.getByLabelText("Brand name · optional")).toHaveDisplayValue("Sam Boxing");
    await press("Continue");
    await heading("How do you coach?");
    expect(api.writes()).toEqual([
      { call: `PATCH ${PROFILE}`, body: { brand_name: "Sam Boxing" } },
    ]);
  });

  it("recovers when completion succeeded but its answer was lost: finishing again is safe", async () => {
    const api = backend(
      { ...PROFILE_FIELDS, coaching_formats: ["online_coaching"] },
      { loseCompletionResponse: true },
    );
    await renderWithProviders(<CoachOnboardingScreen />);
    await heading("How do you coach?");
    await press("Finish");
    expect(await screen.findByText(/couldn’t finish your coach sign-up/)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Your coach profile is ready." })).toBeNull();
    await press("Finish");
    expect(await heading("Your coach profile is ready.")).toBeOnTheScreen();
    expect(api.writes().filter(({ call }) => call === `POST ${COMPLETE}`)).toHaveLength(2);
  });
});
