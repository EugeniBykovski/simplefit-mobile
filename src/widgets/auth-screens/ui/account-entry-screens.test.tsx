import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { ConsentScreen, RoleChoiceScreen } from "./auth-screens";

/*
 * O04 Basics & consent and O05 Choose your role (SF-37) on the SF-44 account
 * registration and the SF-45 entry resolver, with the network mocked at
 * `fetch`. The backend owns every rule; these check what is sent and where
 * the screens go.
 */

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: "http://api.test", webUrl: "https://simplefit.test" },
}));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const consent = (current: boolean, version: string) => ({
  accepted: current,
  accepted_version: current ? version : null,
  accepted_at: current ? "2026-10-01T10:00:00Z" : null,
  current_version: version,
  current,
});
const profile = (overrides: Record<string, unknown> = {}) => ({
  account_profile: {
    registration: {
      status: "not_started",
      completed_at: null,
      missing_requirements: ["full_name", "date_of_birth", "terms", "privacy"],
    },
    full_name: null,
    date_of_birth: null,
    consents: { terms: consent(false, "terms-v1"), privacy: consent(false, "privacy-v1") },
    product_news: { subscribed: false, updated_at: null },
    ...overrides,
  },
});
const entry = (destination: string, intent: string | null = null) =>
  jsonResponse({
    entry: {
      destination,
      reason: "test",
      mandatory: destination === "account_registration" || destination === "fighter_onboarding",
      intent,
      account_registration: "complete",
      fighter_profile: "not_started",
      capabilities: [],
    },
  });
const validation = (field_codes: Record<string, string[]>) =>
  jsonResponse(
    { error: { code: "validation_error", message: "x", details: { fields: {}, field_codes } } },
    { status: 422 },
  );

type Answer = (request: { method: string; search: string; body: unknown }) => Response;
/** Answers by "METHOD /path"; each key's answers in order, the last one repeating. */
function api(routes: Record<string, Answer[]>) {
  const seen = new Map<string, number>();
  return mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const parsed = new URL(url);
      const method = init.method ?? "GET";
      const key = `${method} ${parsed.pathname}`;
      if (parsed.pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      const answers = routes[key];
      if (!answers) throw new Error(`unexpected request ${key}`);
      const index = seen.get(key) ?? 0;
      seen.set(key, index + 1);
      const body = init.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown);
      return Promise.resolve(
        answers[Math.min(index, answers.length - 1)]!({ method, search: parsed.search, body }),
      );
    }),
  );
}
const writes = (fetchMock: jest.Mock) =>
  (fetchMock.mock.calls as [string, RequestInit?][])
    .filter(([, init]) => (init?.method ?? "GET") !== "GET")
    .map(([url, init]) => ({
      call: `${init?.method} ${new URL(url).pathname}`,
      body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    }));

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.push.mockClear();
  mockParams.current = {};
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("O04 Basics & consent", () => {
  it("starts empty, nothing ticked for the person, the documents not linked", async () => {
    api({ "GET /api/v1/me/account-profile": [() => jsonResponse(profile())] });
    await renderWithProviders(<ConsentScreen />);
    expect(await screen.findByRole("header", { name: "A few basics" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Full name")).toHaveDisplayValue("");
    expect(screen.getByLabelText("Date of birth")).toHaveDisplayValue("");
    for (const name of ["Terms of Service", "Privacy Policy", "Product news by email"]) {
      expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
    }
    expect(screen.queryByRole("link")).toBeNull();
    // The artboard's contact-sport notice is not a global requirement (ADR 0016).
    expect(screen.queryByText(/Contact-sport/)).toBeNull();
  });

  it("checks every requirement before completing, and sends only intentional edits", async () => {
    const fetchMock = api({
      "GET /api/v1/me/account-profile": [() => jsonResponse(profile())],
      "PATCH /api/v1/me/account-profile": [() => jsonResponse(profile({ full_name: "Alex K" }))],
    });
    const user = userEvent.setup();
    await renderWithProviders(<ConsentScreen />);
    await user.type(await screen.findByLabelText("Full name"), "Alex K");
    await user.press(screen.getByRole("button", { name: "Agree and continue" }));
    expect(await screen.findByText("Enter your date of birth.")).toBeOnTheScreen();
    expect(screen.getByText("Accept the Terms of Service to continue.")).toBeOnTheScreen();
    expect(screen.getByText("Accept the Privacy Policy to continue.")).toBeOnTheScreen();
    // The valid edit is saved; nothing is ticked or completed for the person.
    expect(writes(fetchMock)).toEqual([
      { call: "PATCH /api/v1/me/account-profile", body: { full_name: "Alex K" } },
    ]);
  });

  it("types the date in the locale's order, sends the calendar date, and completes", async () => {
    const fetchMock = api({
      "GET /api/v1/me/account-profile": [() => jsonResponse(profile())],
      "PATCH /api/v1/me/account-profile": [() => jsonResponse(profile())],
      "POST /api/v1/me/account-profile/complete-registration": [
        () =>
          jsonResponse(
            profile({
              registration: { status: "complete", completed_at: "x", missing_requirements: [] },
            }),
          ),
      ],
    });
    const user = userEvent.setup();
    await renderWithProviders(<ConsentScreen />);
    await user.type(await screen.findByLabelText("Full name"), "Alex Kowalski");
    // `en` is month first.
    await user.type(screen.getByLabelText("Date of birth"), "05172000");
    expect(screen.getByLabelText("Date of birth")).toHaveDisplayValue("05/17/2000");
    await user.press(screen.getByRole("checkbox", { name: "Terms of Service" }));
    await user.press(screen.getByRole("checkbox", { name: "Privacy Policy" }));
    await user.press(screen.getByRole("button", { name: "Agree and continue" }));
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        {
          call: "PATCH /api/v1/me/account-profile",
          body: {
            full_name: "Alex Kowalski",
            date_of_birth: "2000-05-17",
            accept_terms: true,
            accept_privacy: true,
          },
        },
        { call: "POST /api/v1/me/account-profile/complete-registration", body: undefined },
      ]),
    );
  });

  it("shows the server's rejection on its control (too young)", async () => {
    api({
      "GET /api/v1/me/account-profile": [() => jsonResponse(profile())],
      "PATCH /api/v1/me/account-profile": [() => validation({ date_of_birth: ["too_young"] })],
    });
    const user = userEvent.setup();
    await renderWithProviders(<ConsentScreen />);
    await user.type(await screen.findByLabelText("Full name"), "Alex");
    await user.type(screen.getByLabelText("Date of birth"), "01012000");
    await user.press(screen.getByRole("checkbox", { name: "Terms of Service" }));
    await user.press(screen.getByRole("checkbox", { name: "Privacy Policy" }));
    await user.press(screen.getByRole("button", { name: "Agree and continue" }));
    expect(
      await screen.findByText("You must be 16 or older to create an account."),
    ).toBeOnTheScreen();
  });

  it("resumes a saved registration; an accepted current consent stays ticked and locked", async () => {
    api({
      "GET /api/v1/me/account-profile": [
        () =>
          jsonResponse(
            profile({
              registration: {
                status: "in_progress",
                completed_at: null,
                missing_requirements: ["privacy"],
              },
              full_name: "Alex K",
              date_of_birth: "2000-05-17",
              consents: { terms: consent(true, "terms-v1"), privacy: consent(false, "privacy-v2") },
            }),
          ),
      ],
    });
    await renderWithProviders(<ConsentScreen />);
    expect(await screen.findByLabelText("Full name")).toHaveDisplayValue("Alex K");
    expect(screen.getByLabelText("Date of birth")).toHaveDisplayValue("05/17/2000");
    const terms = screen.getByRole("checkbox", { name: "Terms of Service" });
    expect(terms).toBeChecked();
    expect(terms).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Privacy Policy" })).not.toBeChecked();
  });

  it("a network failure keeps what was typed and says so", async () => {
    api({
      "GET /api/v1/me/account-profile": [() => jsonResponse(profile())],
      "PATCH /api/v1/me/account-profile": [
        () => {
          throw new TypeError("Network request failed");
        },
      ],
    });
    const user = userEvent.setup();
    await renderWithProviders(<ConsentScreen />);
    await user.type(await screen.findByLabelText("Full name"), "Alex");
    await user.press(screen.getByRole("button", { name: "Agree and continue" }));
    expect(await screen.findByText(/couldn't save that/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Full name")).toHaveDisplayValue("Alex");
  });
});

describe("O05 Choose your role", () => {
  it("picks nothing by default; Continue is disabled until a journey is chosen", async () => {
    api({});
    await renderWithProviders(<RoleChoiceScreen />);
    expect(
      await screen.findByRole("header", { name: "How will you use SimpleFit?" }),
    ).toBeOnTheScreen();
    for (const name of ["Fighter", "Coach", "Gym / Club", "Sponsor / Brand"]) {
      expect(screen.getByRole("radio", { name })).not.toBeChecked();
    }
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it.each([
    ["Fighter", "fighter", "fighter_onboarding", "/onboarding/fighter?intent=fighter"],
    ["Coach", "coach", "coach_onboarding", "/onboarding/coach?intent=coach"],
    ["Gym / Club", "gym", "gym_onboarding", "/onboarding/gym?intent=gym"],
  ])(
    "%s asks the resolver with its intent and goes where it answers",
    async (name, intent, destination, href) => {
      const fetchMock = api({ "GET /api/v1/me/entry": [() => entry(destination, intent)] });
      const user = userEvent.setup();
      await renderWithProviders(<RoleChoiceScreen />);
      await user.press(await screen.findByRole("radio", { name }));
      await user.press(screen.getByRole("button", { name: `Continue as ${name}` }));
      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(href));
      const searches = (fetchMock.mock.calls as [string][]).map(([url]) => new URL(url).search);
      expect(searches).toContain(`?intent=${intent}`);
      expect(writes(fetchMock)).toEqual([]);
    },
  );

  it("a completed Fighter choosing Fighter goes home", async () => {
    api({ "GET /api/v1/me/entry": [() => entry("fighter_home", "fighter")] });
    const user = userEvent.setup();
    await renderWithProviders(<RoleChoiceScreen />);
    await user.press(await screen.findByRole("radio", { name: "Fighter" }));
    await user.press(screen.getByRole("button", { name: "Continue as Fighter" }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/home"));
  });

  it("Sponsor / Brand opens the web partner application, never a workspace", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    api({ "GET /api/v1/me/entry": [() => entry("sponsor_application", "sponsor")] });
    const user = userEvent.setup();
    await renderWithProviders(<RoleChoiceScreen />);
    await user.press(await screen.findByRole("radio", { name: "Sponsor / Brand" }));
    await user.press(screen.getByRole("button", { name: "Continue as Sponsor / Brand" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://simplefit.test/partners/apply"));
    expect(mockRouter.push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("an explicit sponsor intent preselects Sponsor / Brand", async () => {
    mockParams.current = { intent: "sponsor" };
    api({});
    await renderWithProviders(<RoleChoiceScreen />);
    expect(await screen.findByRole("radio", { name: "Sponsor / Brand" })).toBeChecked();
  });

  it("a failed resolution stays with a message; a retry goes through", async () => {
    api({
      "GET /api/v1/me/entry": [
        () =>
          jsonResponse(
            { error: { code: "service_unavailable", message: "x", details: {} } },
            { status: 503 },
          ),
        () => entry("coach_onboarding", "coach"),
      ],
    });
    const user = userEvent.setup();
    await renderWithProviders(<RoleChoiceScreen />);
    await user.press(await screen.findByRole("radio", { name: "Coach" }));
    await user.press(screen.getByRole("button", { name: "Continue as Coach" }));
    expect(await screen.findByText(/couldn't open that setup/)).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
    await user.press(screen.getByRole("button", { name: "Continue as Coach" }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/onboarding/coach?intent=coach"),
    );
  });

  it("a destination this version does not map is a failure, never a guess", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    api({ "GET /api/v1/me/entry": [() => entry("coach_workspace", "coach")] });
    const user = userEvent.setup();
    await renderWithProviders(<RoleChoiceScreen />);
    await user.press(await screen.findByRole("radio", { name: "Coach" }));
    await user.press(screen.getByRole("button", { name: "Continue as Coach" }));
    expect(await screen.findByText(/can't open it yet/)).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
