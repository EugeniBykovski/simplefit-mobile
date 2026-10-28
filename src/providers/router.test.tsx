import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { focusManager } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  type MockContextConfig,
} from "expo-router/testing-library";
// The navigation state itself (SF-80 asserts no URL fragment ever reaches it).
import { store } from "expo-router/build/global-state/router-store";

import { completeAuthentication } from "@/entities/session";
import { pending } from "@/features/email-auth/model/pending";
import { resetSessionForTests } from "@/entities/session/model/session";
import { getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch } from "@/test/render";
import { mobileRoutes } from "@/shared/routes/mobile-routes";
import type { MobileRoute } from "@/shared/routes/routes";
import type { EntryResponseEntry } from "@/shared/api/generated/model";

import registry from "../../docs/route-registry.json";

import { ErrorBoundary } from "../app/_layout";
import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

// System-state motion rests static (deterministic renders, no act() noise).
jest.mock("@/shared/lib/reduced-motion", () => ({ useReducedMotion: () => true }));

/*
 * SF-33: the production Expo Router tree (src/app) resolves the SF-31 mobile
 * route graph at runtime. The real route files and shell layouts render
 * under the real providers; only fonts and the splash screen (root
 * _layout.tsx) are left out.
 */
function TestRootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

/**
 * The src/app files as Metro's route context lists them (`./+native-intent.tsx`
 * included, which Expo Router reads before any route), with the test root
 * layout. Modules load on first use. (`renderRouter`'s `appDir` + `overrides`
 * form strips the `./` and extension from every key, so Expo Router would
 * take `+native-intent` for a route.)
 */
function appContext(overrides: Record<string, unknown> = {}): MockContextConfig {
  const dir = join(__dirname, "../app");
  const context: Record<string, unknown> = {};
  for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file) || file === "_layout.tsx") continue;
    Object.defineProperty(context, file.replace(/\.tsx?$/, ""), {
      enumerable: true,
      get: () => jest.requireActual(join(dir, file)),
    });
  }
  return Object.assign(
    context,
    { _layout: { default: TestRootLayout } },
    overrides,
  ) as MockContextConfig;
}

/** Renders the app at `url`; the result also reads the router's current location. */
async function renderApp(url: string) {
  const result = renderRouter(appContext(), { initialUrl: url });
  // Testing Library's render is asynchronous; renderRouter attaches its readers to the promise.
  const rendered = await result;
  return {
    ...rendered,
    getPathname: result.getPathname,
    getSearchParams: result.getSearchParams,
  };
}

type Entry = EntryResponseEntry;

/** A registered user without role state: the backend's role selection (SF-45). */
const ROLE_SELECTION: Entry = {
  destination: "role_selection",
  reason: "no_role_started",
  mandatory: false,
  intent: null,
  context: null,
  account_registration: "complete",
  fighter_profile: "not_started",
  coach_profile: "not_started",
  capabilities: [],
  gym_id: null,
  gym_workspaces: [],
  gym_workspace_count: 0,
};
const FIGHTER_HOME: Entry = {
  ...ROLE_SELECTION,
  destination: "fighter_home",
  reason: "fighter_onboarding_completed",
  fighter_profile: "completed",
  capabilities: ["FIGHTER"],
};
const FIGHTER_ONBOARDING: Entry = {
  ...ROLE_SELECTION,
  destination: "fighter_onboarding",
  reason: "fighter_onboarding_not_started",
  mandatory: true,
};
const ACCOUNT_REGISTRATION: Entry = {
  ...ROLE_SELECTION,
  destination: "account_registration",
  reason: "account_registration_incomplete",
  mandatory: true,
  account_registration: "not_started",
};

const COACH_ONBOARDING: Entry = {
  ...ROLE_SELECTION,
  destination: "coach_onboarding",
  reason: "coach_intent",
};
const COACH_HOME: Entry = {
  ...ROLE_SELECTION,
  destination: "coach_home",
  reason: "coach_onboarding_completed",
  context: "coach",
  coach_profile: "completed",
  capabilities: ["COACH"],
};
const BOTH: Entry = {
  ...FIGHTER_HOME,
  reason: "last_context",
  context: "fighter",
  coach_profile: "completed",
  capabilities: ["FIGHTER", "COACH"],
};

/** SF-89: one completed gym, remembered (`gym_home` with its id). */
const GYM_HOME_ID = "8d2e4f60-1a2b-4c3d-8e9f-a0b1c2d3e4f5";
const GYM_HOME: Entry = {
  ...ROLE_SELECTION,
  destination: "gym_home",
  reason: "gym_workspace_completed",
  gym_id: GYM_HOME_ID,
  capabilities: ["GYM_WORKSPACE"],
  gym_workspaces: [
    {
      gym_id: GYM_HOME_ID,
      name: "Ring A Boxing",
      role: "owner",
      setup_status: "completed",
      available_actions: ["enter"],
      selected: true,
    },
  ],
  gym_workspace_count: 1,
};

/** Account registration before its first save (SF-44), for O04. */
const NOT_STARTED = {
  registration: {
    status: "not_started",
    completed_at: null,
    missing_requirements: ["full_name", "date_of_birth", "terms", "privacy"],
  },
  full_name: null,
  date_of_birth: null,
  consents: {
    terms: {
      accepted: false,
      accepted_version: null,
      accepted_at: null,
      current_version: "terms-v1",
      current: false,
    },
    privacy: {
      accepted: false,
      accepted_version: null,
      accepted_at: null,
      current_version: "privacy-v1",
      current: false,
    },
  },
  product_news: { subscribed: false, updated_at: null },
};

/**
 * A signed-in viewer, through the same pipeline every sign-in method uses
 * (SF-24); the API resolves the entry (`GET /api/v1/me/entry`, SF-45) as
 * `entry`.
 */
/** SF-25: a completed Fighter profile (SF-41 first-run tests). */
const FIGHTER_COMPLETED = {
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
    completed_at: "2026-10-09T10:00:00Z",
    missing_requirements: [],
  },
};

/** SF-25: the profile before the first save (every field empty). */
const FIGHTER_NOT_STARTED = {
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
  onboarding: {
    status: "not_started",
    completed_at: null,
    missing_requirements: [
      "display_name",
      "username",
      "country_code",
      "city",
      "experience_level",
      "stance",
    ],
  },
};

/** SF-40/SF-41 first-run experiences as the backend lists them. */
const firstRun = (mobile: string, web = "pending") => ({
  experiences: [
    { experience: "fighter_web_tour", status: web, recorded_at: null },
    { experience: "fighter_mobile_first_run", status: mobile, recorded_at: null },
  ],
});

/** SF-50: a Coach profile as the backend derives it from its fields. */
function coachProfile(fields: Record<string, unknown> = {}, completed = false) {
  const merged: Record<string, unknown> = {
    display_name: null,
    brand_name: null,
    country_code: null,
    city: null,
    bio: null,
    languages: [],
    coaching_formats: [],
    competition_levels: [],
    ...fields,
  };
  return {
    ...merged,
    onboarding: {
      status: completed
        ? "completed"
        : Object.keys(fields).length > 0
          ? "in_progress"
          : "not_started",
      completed_at: completed ? "2026-10-14T10:00:00Z" : null,
      missing_requirements: completed
        ? []
        : [
            ...["display_name", "country_code", "city"].filter((field) => merged[field] === null),
            ...((merged.coaching_formats as unknown[]).length === 0 ? ["coaching_formats"] : []),
          ],
    },
  };
}

/** SF-50: a completed Coach profile (SF-55 Coach today). */
const COACH_COMPLETED = coachProfile(
  {
    display_name: "Coach Sam",
    brand_name: "Sam Boxing",
    country_code: "PL",
    city: "Kraków",
    languages: ["en", "pl"],
    coaching_formats: ["personal_training", "fight_camps"],
    competition_levels: ["amateur"],
  },
  true,
);

async function signIn(
  entry: Entry | ((intent: string | null) => Entry) = ROLE_SELECTION,
  fighter: object = FIGHTER_NOT_STARTED,
  mobileFirstRun = "completed",
  coach: object = coachProfile(),
  gyms: GymFixture[] = [],
) {
  const resolve = (intent: string | null) => ({
    ...(typeof entry === "function" ? entry(intent) : entry),
    intent,
  });
  mockFetch(
    jest.fn((url: string) =>
      Promise.resolve(
        url.includes("/api/v1/me/gyms")
          ? jsonResponse({ gyms: gyms.map(gymSummary), next_cursor: null })
          : /\/api\/v1\/gyms\/[^/]+\/setup/.test(url)
            ? jsonResponse({ setup: gymSetup(gyms.find((gym) => url.includes(gym.id))) })
            : /\/api\/v1\/gyms\/[^/?]+$/.test(url)
              ? gymResponse(gyms.find((gym) => url.endsWith(`/gyms/${gym.id}`)))
              : url.includes("/api/v1/me/entry")
                ? jsonResponse({ entry: resolve(new URL(url).searchParams.get("intent")) })
                : url.includes("/api/v1/me/account-profile")
                  ? jsonResponse({ account_profile: NOT_STARTED })
                  : url.includes("/api/v1/me/fighter-profile")
                    ? jsonResponse({ fighter_profile: fighter })
                    : url.includes("/api/v1/me/coach-profile")
                      ? jsonResponse({ coach_profile: coach })
                      : url.includes("/api/v1/me/first-run")
                        ? jsonResponse(firstRun(mobileFirstRun))
                        : /\/api\/v1\/me\/(coach\/fighters|coach\/training-sessions|training-sessions)\/[^?]/.test(
                              url,
                            )
                          ? jsonResponse(
                              {
                                error: {
                                  code: "not_found",
                                  message: "Not found",
                                  details: {},
                                  request_id: "r",
                                },
                              },
                              { status: 404 },
                            )
                          : url.includes("/api/v1/me/coaches") ||
                              url.includes("/api/v1/me/coach/fighters")
                            ? jsonResponse({ relationships: [], next_cursor: null })
                            : url.includes("/api/v1/me/coach/training-sessions") ||
                                url.includes("/api/v1/me/training-sessions")
                              ? jsonResponse({ training_sessions: [], next_cursor: null })
                              : url.includes("/api/v1/me/coach/invitations") ||
                                  url.includes("/api/v1/me/coach-invitations")
                                ? jsonResponse({ invitations: [], next_cursor: null })
                                : jsonResponse({
                                    user: {
                                      id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
                                      created_at: "2026-10-01T10:00:00Z",
                                    },
                                  }),
      ),
    ),
  );
  await completeAuthentication({
    access_token: "test-access",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "test-refresh",
  });
}

/** A gym the signed-in user works at (SF-83 / SF-85), as the gym fixtures of `signIn`. */
type GymFixture = {
  id: string;
  name: string;
  status: "draft" | "completed";
  located: boolean;
  role?: "owner" | "manager" | "coach" | "front_desk";
};
const DRAFT_GYM: GymFixture = {
  id: "5f0c3d0e-4a1b-4c2d-9e8f-0a1b2c3d4e5f",
  name: "Praga Boxing",
  status: "draft",
  located: false,
};
/** SF-89: a completed gym the user owns, with its primary location. */
const COMPLETED_GYM: GymFixture = {
  id: "8d2e4f60-1a2b-4c3d-8e9f-a0b1c2d3e4f5",
  name: "Ring A Boxing",
  status: "completed",
  located: true,
};
/** The entry's gym workspace row of a gym fixture (SF-84). */
const workspaceOf = (gym: GymFixture) => ({
  gym_id: gym.id,
  name: gym.name,
  role: gym.role ?? "owner",
  setup_status: gym.status,
  available_actions:
    gym.status === "completed" ? ["enter"] : gym.role === undefined ? ["continue_setup"] : [],
  selected: false,
});
const VIEWER_MEMBERSHIP = {
  role: "owner",
  permissions: [],
  staff_membership_id: "7a1b2c3d-0000-4000-8000-000000000002",
};
const gymSummary = (gym: GymFixture) => ({
  id: gym.id,
  name: gym.name,
  gym_type: "boxing_gym",
  setup_status: gym.status,
  inserted_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
  viewer: { ...VIEWER_MEMBERSHIP, role: gym.role ?? "owner" },
});
/** `GET /api/v1/gyms/{gym_id}` (SF-83): the gym for its staff, 404 for anyone else. */
const gymResponse = (gym: GymFixture | undefined) =>
  gym === undefined
    ? jsonResponse(
        { error: { code: "not_found", message: "Not found", details: {}, request_id: "r" } },
        { status: 404 },
      )
    : jsonResponse({
        gym: {
          ...gymSummary(gym),
          locations: gym.located
            ? [
                {
                  id: "0b6e1c2d-0000-4000-8000-0000000000aa",
                  name: "Warsaw",
                  country_code: "PL",
                  city: "Warsaw",
                  address_line: "ul. Ząbkowska 31",
                  entrance_note: null,
                  is_primary: true,
                },
              ]
            : [],
          viewer: {
            ...VIEWER_MEMBERSHIP,
            role: gym.role ?? "owner",
            permissions: (gym.role ?? "owner") === "owner" ? ["complete_setup", "edit_gym"] : [],
          },
        },
      });
const gymSetup = (gym: GymFixture | undefined) =>
  gym === undefined
    ? undefined
    : {
        gym_id: gym.id,
        name: gym.name,
        gym_type: "boxing_gym",
        phone: null,
        website: null,
        tagline: null,
        accent_color: null,
        primary_location: gym.located
          ? {
              id: "0b6e1c2d-0000-4000-8000-0000000000aa",
              name: "Warsaw",
              country_code: "PL",
              city: "Warsaw",
              address_line: "ul. Ząbkowska 31",
              entrance_note: null,
              is_primary: true,
            }
          : null,
        revision: 2,
        setup_status: gym.status,
        missing_requirements: gym.status === "completed" || gym.located ? [] : ["primary_location"],
        viewer: VIEWER_MEMBERSHIP,
      };

/** A representative URL: every parameter gets a sample opaque id. */
const sampleUrl = (route: MobileRoute) =>
  route.path.replace(/:(\w+)/g, (_match, name: string) => `${name}-1`);

const placeholderId = (id: string) => `feature-placeholder:${id}`;

beforeEach(() => {
  resetSessionForTests();
});

// Navigation schedules work on (fake) timers; settle it before the next test renders.
afterEach(async () => {
  await act(async () => jest.runOnlyPendingTimers());
});

describe("canonical routes resolve", () => {
  const routable = mobileRoutes.filter(
    (route) => route.nav !== "CATCH_ALL" && route.status !== "DEFERRED",
  );

  it.each(routable.map((route) => [route.id, route] as const))(
    "%s renders its own screen at its canonical path",
    async (_id, route) => {
      // O04 shows only while account registration is incomplete (SF-37); the
      // Fighter introduction only while its first run is pending (SF-41).
      if (route.id === "mobile.welcome.tour")
        await signIn(FIGHTER_HOME, FIGHTER_COMPLETED, "pending");
      // The gym shell needs GYM_WORKSPACE and the backend's answer for the gym in the route (SF-89).
      else if (route.shell === "mobile.gym")
        await signIn(GYM_HOME, FIGHTER_NOT_STARTED, "completed", coachProfile(), [
          { ...COMPLETED_GYM, id: "gymId-1" },
        ]);
      else if (route.session === "AUTHENTICATED")
        await signIn(
          route.id === "mobile.signup.consent"
            ? ACCOUNT_REGISTRATION
            : // The Coach workspace needs the COACH capability the entry reports (SF-53).
              route.shell === "mobile.coach"
              ? COACH_HOME
              : // A04 shows while the entry answers a home or context_selection (SF-55);
                // the Fighter workspace needs the FIGHTER capability (SF-66).
                route.id === "mobile.workspaces" || route.shell === "mobile.fighter"
                ? FIGHTER_HOME
                : ROLE_SELECTION,
        );
      // The code screens need the pending email flow of the step before them (SF-24).
      if (route.id === "mobile.login.code") {
        pending.set("signIn", { email: "fighter@example.com", resendAt: Date.now() + 60_000 });
      }
      if (route.id === "mobile.signup.verify") {
        pending.set("registration", {
          email: "fighter@example.com",
          registrationToken: "sfg_test",
          resendAt: Date.now() + 60_000,
        });
      }
      const url = sampleUrl(route);
      const result = await renderApp(url);

      await waitFor(() => expect(result.getPathname()).toBe(url));
      if (readFileSync(fileOf(route), "utf8").includes("placeholderRoute(")) {
        expect(await screen.findByTestId(placeholderId(route.id))).toBeOnTheScreen();
      }
      // Still there once every effect and redirect has run (no loop, no bounce).
      await act(async () => jest.runOnlyPendingTimers());
      expect(result.getPathname()).toBe(url);
    },
  );

  it("passes dynamic parameters through unchanged", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/gym/g-42/classes/c-7/book");
    expect(
      await screen.findByTestId(placeholderId("mobile.gym._gym-id.classes._class-id.book")),
    ).toBeOnTheScreen();
    expect(result.getSearchParams()).toEqual({ gymId: "g-42", classId: "c-7" });
  });

  it("serves fighter and workspace routes that share the /gym and /coach prefixes", async () => {
    // SF-89: the gym shell is id-based (/gyms/:gymId/**); the member side keeps /gym/:gymId.
    await signIn(GYM_HOME, FIGHTER_NOT_STARTED, "completed", coachProfile(), [COMPLETED_GYM]);
    await renderApp(`/gyms/${COMPLETED_GYM.id}/check-in`);
    expect(
      await screen.findByTestId(placeholderId("mobile.gyms._gym-id.check-in")),
    ).toBeOnTheScreen();
  });

  it("sends unknown and deferred paths to the not-found screen", async () => {
    await renderApp("/nowhere/at/all");
    expect(
      await screen.findByRole("header", { name: "This page is down for the count." }),
    ).toBeOnTheScreen();
  });

  it("does not build the deferred /sparring/find", async () => {
    await signIn();
    await renderApp("/sparring/find");
    expect(
      await screen.findByRole("header", { name: "This page is down for the count." }),
    ).toBeOnTheScreen();
  });
});

describe("verified invitation links (SF-80)", () => {
  // As the E08 email carries it; src/app/+native-intent.tsx receives every
  // system URL first (here Expo Router's own form of it, without the origin).
  const TOKEN = "sfi_c2VjcmV0LWludml0YXRpb24tdG9rZW4";
  const LINK = `/invite/coach#token=${TOKEN}`;
  const INBOX = "/profile/coaches/invitations";

  /** Nothing of the token anywhere in the navigation state. */
  const expectNoToken = () => {
    const state = JSON.stringify(store.navigationRef.current?.getRootState() ?? {});
    expect(state).not.toContain(TOKEN);
    expect(state).not.toContain("token=");
    expect(state).not.toContain("%23");
    expect(state).not.toContain('"#"');
  };

  it("sends a signed-out visitor to sign-in with the inbox continuation", async () => {
    const result = await renderApp(LINK);
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: INBOX, intent: "fighter" });
    expect(await screen.findByRole("button", { name: "Google" })).toBeOnTheScreen();
    expectNoToken();
  });

  it("opens the inbox for a signed-in fighter; nothing is accepted on the way", async () => {
    await signIn(FIGHTER_HOME, FIGHTER_COMPLETED);
    const result = await renderApp(LINK);
    await waitFor(() => expect(result.getPathname()).toBe(INBOX));
    expect(await screen.findByText("No invitations")).toBeOnTheScreen();
    expectNoToken();
    const calls = (global.fetch as jest.Mock).mock.calls.map(
      ([url, init]: [string, RequestInit | undefined]) => `${init?.method ?? "GET"} ${url}`,
    );
    expect(calls.filter((call) => !call.startsWith("GET "))).toEqual([]);
  });

  it("finishes Fighter onboarding first, carrying the continuation", async () => {
    await signIn((intent) => (intent === "fighter" ? FIGHTER_ONBOARDING : ROLE_SELECTION));
    const result = await renderApp(LINK);
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/fighter"));
    expect(result.getSearchParams()).toEqual({ returnTo: INBOX, intent: "fighter" });
    expectNoToken();
  });

  it("finishes account registration first", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp(LINK);
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expectNoToken();
  });

  it("never carries a fragment into returnTo (the gate copies every route param there)", async () => {
    const result = await renderApp(`/camp/weight#token=${TOKEN}`);
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: "/camp/weight" });
    expectNoToken();
  });
});

describe("session access (UX only)", () => {
  it("sends a signed-out visitor of a signed-in route to sign-in with returnTo", async () => {
    const result = await renderApp("/camp/weight");
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: "/camp/weight" });
    expect(await screen.findByRole("button", { name: "Google" })).toBeOnTheScreen();
  });

  it("keeps the requested query in returnTo, without the route's own parameters", async () => {
    const result = await renderApp("/messages/t-1?draft=1");
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: "/messages/t-1?draft=1" });
  });

  it("sends a signed-in user away from guest-only routes to the entry route", async () => {
    await signIn();
    const result = await renderApp("/welcome");
    await waitFor(() => expect(result.getPathname()).toBe("/"));
  });

  it("enters a valid returnTo the backend state allows once the viewer is authenticated (SF-24, SF-45)", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/login?returnTo=%2Fcamp%2Fweight");
    await waitFor(() => expect(result.getPathname()).toBe("/camp/weight"));
  });

  it.each(["//evil.example", "/onboarding/role", "/login", "simplefit://camp"])(
    "ignores the unsafe returnTo %s and enters the resolved destination",
    async (returnTo) => {
      await signIn();
      const result = await renderApp(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      await waitFor(() => expect(result.getPathname()).toBe("/onboarding/role"));
      expect(result.getSearchParams()).toEqual({});
    },
  );

  it("does not add returnTo for a screen sign-in cannot lead to (onboarding)", async () => {
    const result = await renderApp("/onboarding/role");
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({});
  });

  it("shows the retryable failure state, not sign-in, when the restore fails offline", async () => {
    await setSecureItem("simplefit.session.refresh_token", "stored-refresh");
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));
    const result = await renderApp("/camp/weight");
    expect(await screen.findByRole("button", { name: "Try again" })).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/camp/weight");
  });

  it("lets everyone open public routes in gated shells", async () => {
    const result = await renderApp("/checkout");
    expect(await screen.findByTestId(placeholderId("mobile.checkout"))).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/checkout");
  });

  it("shows signed-out visitors the guest-only welcome screen with Google and Apple", async () => {
    await renderApp("/welcome");
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Continue with Apple" })).toBeOnTheScreen();
  });

  it("opens the routes whose capability is not checked yet for any signed-in user", async () => {
    await signIn();
    for (const url of ["/home", "/onboarding/fighter"]) {
      const result = await renderApp(url);
      await waitFor(() => expect(result.getPathname()).toBe(url));
      await result.unmount();
    }
  });
});

/*
 * SF-28: signing out from the signed-in app and from the setup screens, and a
 * session the API stops accepting, through the real routes and gates.
 */
describe("sign-out and session end (SF-28)", () => {
  const refreshTokenKey = "simplefit.session.refresh_token";

  /**
   * Presses Sign out and lets its whole handler (sign-out, Google sign-out,
   * navigation) finish inside this test, in one awaited act scope: the tests
   * run on fake timers, so its timers are flushed afterwards in their own.
   */
  async function pressSignOut() {
    await fireEvent.press(await screen.findByRole("button", { name: "Sign out" }));
    await act(async () => {
      for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    });
    await act(async () => jest.runOnlyPendingTimers());
  }

  it("Profile → Settings → Sign out: back to welcome, credentials gone, Back shows nothing private", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/profile");
    await fireEvent.press(
      await screen.findByRole("button", { name: "Settings · account · privacy" }),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/settings"));

    await pressSignOut();

    await waitFor(() => expect(result.getPathname()).toBe("/welcome"));
    expect(await screen.findByText("You’re signed out on this device.")).toBeOnTheScreen();
    expect(await getSecureItem(refreshTokenKey)).toBeNull();
    // Nothing of the previous session is carried to the next sign-in.
    expect(result.getSearchParams()).toEqual({});

    // Back (Android's hardware button) cannot reopen a signed-in screen.
    await act(async () => {
      if (router.canGoBack()) router.back();
    });
    await act(async () => jest.runOnlyPendingTimers());
    expect(screen.queryByTestId("account-menu:settings")).toBeNull();
    expect(screen.queryByTestId("account-menu:profile")).toBeNull();
    await result.unmount();
  });

  it("a wrong account can sign out of account basics (O04) instead of being stuck", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/signup/consent");
    await pressSignOut();
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"));
    expect(await getSecureItem(refreshTokenKey)).toBeNull();
    await result.unmount();
  });

  it("a wrong account can sign out of the journey choice (O05)", async () => {
    await signIn(ROLE_SELECTION);
    const result = await renderApp("/onboarding/role");
    await pressSignOut();
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"));
    await result.unmount();
  });

  it("a session the API stops accepting ends with a notice and a safe returnTo", async () => {
    await signIn(FIGHTER_HOME, FIGHTER_COMPLETED);
    // The access token is rejected and so is the one refresh after it.
    mockFetch(
      jest.fn(() =>
        Promise.resolve(
          jsonResponse(
            { error: { code: "unauthorized", message: "", details: {} } },
            { status: 401 },
          ),
        ),
      ),
    );

    const result = await renderApp("/home");

    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: "/home" });
    expect(
      await screen.findByText("Your session ended. Sign in again to continue."),
    ).toBeOnTheScreen();
    expect(await getSecureItem(refreshTokenKey)).toBeNull();
    await result.unmount();
  });
});

describe("tab navigation", () => {
  it("shows the fighter tabs with the current tab selected, and switches tabs", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/home");
    expect(await screen.findByRole("tab", { name: "Home", selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText("Fighter navigation")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Training" }));
    await waitFor(() => expect(result.getPathname()).toBe("/training"));
    expect(await screen.findByRole("tab", { name: "Training", selected: true })).toBeOnTheScreen();
  });

  it("shows the Coach MVP tabs: Today, Fighters (SF-61), Sessions (SF-65), Settings above the tabs", async () => {
    await signIn(BOTH, FIGHTER_COMPLETED, "completed", COACH_COMPLETED);
    const result = await renderApp("/coach/today");
    expect(await screen.findByRole("tab", { name: "Today", selected: true })).toBeOnTheScreen();
    // SF-65: Sessions is the real planner, no longer Soon.
    expect(screen.queryByRole("tab", { name: "Sessions, not available yet" })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Sessions" }));
    await waitFor(() => expect(result.getPathname()).toBe("/coach/sessions"));
    expect(await screen.findByRole("tab", { name: "Sessions", selected: true })).toBeOnTheScreen();
    expect(await screen.findByText("No upcoming sessions")).toBeOnTheScreen();
    // SF-61: Fighters is the real roster.
    await fireEvent.press(screen.getByRole("tab", { name: "Fighters" }));
    await waitFor(() => expect(result.getPathname()).toBe("/coach/fighters"));
    expect(await screen.findByRole("tab", { name: "Fighters", selected: true })).toBeOnTheScreen();
    expect(await screen.findByText("No fighters yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Today" }));
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
    for (const gone of ["Board", "Requests", "Inbox"])
      expect(screen.queryByRole("tab", { name: gone })).toBeNull();
    // The shared ST1 (SF-28), pushed above the tabs.
    await fireEvent.press(screen.getByRole("tab", { name: "Settings" }));
    await waitFor(() => expect(result.getPathname()).toBe("/settings"));
    expect(await screen.findByTestId("account-menu:settings")).toBeOnTheScreen();
    // The first screen of the shared stack goes back to the tab it was opened from.
    await fireEvent.press(await screen.findByRole("button", { name: "Back" }));
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
    expect(await screen.findByRole("tab", { name: "Today", selected: true })).toBeOnTheScreen();
  });

  it("links the gym tab bar's Pulse only; the other gym tabs are Soon (SF-89)", async () => {
    await signIn(GYM_HOME, FIGHTER_NOT_STARTED, "completed", coachProfile(), [COMPLETED_GYM]);
    const result = await renderApp(`/gyms/${COMPLETED_GYM.id}/staff/on-shift`);
    for (const tab of ["Classes", "QR check-in", "Members", "Staff"]) {
      const soon = await screen.findByRole("tab", { name: `${tab}, not available yet` });
      expect(soon).toBeDisabled();
    }
    await fireEvent.press(screen.getByRole("tab", { name: "Pulse" }));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${COMPLETED_GYM.id}/pulse`));
    expect(await screen.findByRole("tab", { name: "Pulse", selected: true })).toBeOnTheScreen();
  });

  it("keeps the tab bar on the screens the design shows inside a tab, with that tab active", async () => {
    await signIn(BOTH);
    for (const [url, tab] of [
      ["/progress", "Profile"],
      ["/calendar", "Training"],
      ["/marketplace", "Community"],
      ["/coach/challenge/c-1", "Today"],
    ] as const) {
      const result = await renderApp(url);
      expect(await screen.findByRole("tab", { name: tab, selected: true })).toBeOnTheScreen();
      expect(result.getPathname()).toBe(url);
      await result.unmount();
    }
  });

  it("returns from a tab section to its tab root", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/progress");
    await screen.findByRole("tab", { name: "Profile", selected: true });
    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/profile"));
    expect(await screen.findByRole("tab", { name: "Profile", selected: true })).toBeOnTheScreen();
  });

  it("pushes detail screens above the tabs, without the tab bar", async () => {
    await signIn(FIGHTER_HOME);
    await renderApp("/camp/weight");
    await screen.findByTestId(placeholderId("mobile.camp.weight"));
    expect(screen.queryByRole("tab", { name: "Home" })).toBeNull();
  });

  it("goes back from a pushed screen to the tab it was opened from", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/profile");
    await screen.findByTestId("account-menu:profile");
    await act(async () => router.push("/achievements"));
    await waitFor(() => expect(result.getPathname()).toBe("/achievements"));
    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/profile"));
  });

  it("keeps the tabs underneath a deep-linked pushed screen", async () => {
    await signIn(BOTH);
    const result = await renderApp("/coach/fighters/f-1/note");
    await screen.findByTestId(placeholderId("mobile.coach.fighters._fighter-id.note"));
    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
  });
});

/** The registry production file of a route (generated metadata keeps no files). */
function fileOf(route: MobileRoute): string {
  const entry = registry.routes.find((candidate) => candidate.id === route.id);
  const file = entry && "production" in entry ? entry.production?.file : undefined;
  if (!file) throw new Error(`${route.id} has no production file`);
  return file;
}

describe("system states (SF-34)", () => {
  it("never opens a Fighter route for someone without FIGHTER (SF-66): the entry decides", async () => {
    await signIn(COACH_HOME);
    const result = await renderApp("/training");
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
    // Nothing of the fighter's training is shown. (The navigator stays mounted
    // under the gate, so the list may be asked for once; without a fighter
    // profile the backend answers 404.)
    expect(screen.queryByText("No upcoming training")).toBeNull();
    expect(screen.queryByText("Training")).toBeNull();
  });

  it("covers a gated route with the LD1 launch screen while the session is restored, in the same navigator", async () => {
    await setSecureItem("simplefit.session.refresh_token", "stored-refresh");
    let respond: (response: Response) => void = () => {};
    // The refresh waits for the test; GET /api/me then resolves the viewer (SF-24).
    mockFetch(
      jest
        .fn()
        .mockImplementationOnce(() => new Promise<Response>((resolve) => (respond = resolve)))
        .mockImplementation((url: string) =>
          Promise.resolve(
            url.includes("/api/v1/me/entry")
              ? jsonResponse({ entry: { ...FIGHTER_HOME, intent: null } })
              : url.includes("/api/v1/me/training-sessions")
                ? jsonResponse({ training_sessions: [], next_cursor: null })
                : jsonResponse({
                    user: {
                      id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
                      created_at: "2026-10-01T10:00:00Z",
                    },
                  }),
          ),
        ),
    );

    const result = await renderApp("/training");
    expect(await screen.findByLabelText("Loading SimpleFit")).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/training");

    await act(async () =>
      respond(
        jsonResponse({
          access_token: "fresh-access",
          access_token_expires_at: "2099-01-01T00:00:00Z",
          refresh_token: "fresh-refresh",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token_transport: "body",
        }),
      ),
    );
    // SF-66: Training is the fighter's real schedule, behind the FIGHTER gate.
    expect(await screen.findByText("No upcoming training")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Loading SimpleFit")).toBeNull();
    expect(result.getPathname()).toBe("/training");
  });

  it("renders the root error boundary without the error's details", async () => {
    // React logs caught errors in development; this one is thrown on purpose.
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("db password=hunter2");
    }
    const result = renderRouter(
      appContext({ _layout: { default: TestRootLayout, ErrorBoundary }, boom: Boom }),
      { initialUrl: "/boom" },
    );
    await result;
    expect(await screen.findByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.queryByText(/hunter2/)).toBeNull();
    log.mockRestore();
  });
});

describe("entry resolution (SF-45)", () => {
  it("a new user from any sign-in method without intent goes to O04, never Fighter", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/login");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({});
  });

  it("carries an explicit intent from a deep link through sign-in to O04", async () => {
    await signIn({ ...ACCOUNT_REGISTRATION });
    const result = await renderApp("/signup?intent=fighter");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({ intent: "fighter" });
  });

  it("drops an intent outside the allow-list", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/signup?intent=admin");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({});
  });

  it("without an intent (lost with the process) a registered user chooses at O05", async () => {
    await signIn(ROLE_SELECTION);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/role"));
  });

  it("a completed fighter enters Fighter home", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
  });

  it("a completed coach enters Coach today (SF-51 coach_home, SF-52)", async () => {
    await signIn({
      ...FIGHTER_HOME,
      destination: "coach_home",
      reason: "coach_onboarding_completed",
      fighter_profile: "not_started",
      coach_profile: "completed",
      capabilities: ["COACH"],
    });
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
  });

  it("intent=sponsor: O05, no Sponsor capability, no workspace created or shown", async () => {
    await signIn({
      ...ROLE_SELECTION,
      destination: "sponsor_application",
      reason: "sponsor_intent",
    });
    const result = await renderApp("/?intent=sponsor");
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/role"));
    expect(result.getSearchParams()).toEqual({ intent: "sponsor" });
    // O05, with the Sponsor / Brand journey the intent asked for preselected.
    expect(
      await screen.findByRole("header", { name: "How will you use SimpleFit?" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Sponsor / Brand" })).toBeChecked();
    await act(async () => jest.runOnlyPendingTimers());
    expect(result.getPathname()).toBe("/onboarding/role");
    expect(screen.queryByTestId(placeholderId("mobile.workspaces"))).toBeNull();

    // Routing only read: the viewer and the entry, never a workspace, and nothing was written.
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit?][];
    const requests = calls.map(
      ([url, init]) => `${init?.method ?? "GET"} ${new URL(url).pathname}`,
    );
    expect(requests.every((request) => /^GET \/api\/(me|v1\/me\/entry)$/.test(request))).toBe(true);
    expect(requests).toContain("GET /api/v1/me/entry");
    expect(calls.some(([url]) => /workspace/i.test(url))).toBe(false);
  });

  it("O04 continues to the resolved entry once registration is complete (any client)", async () => {
    await signIn(ROLE_SELECTION);
    const result = await renderApp("/signup/consent");
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/role"));
  });

  it("O05 shows only for role selection: a completed Fighter continues home", async () => {
    await signIn(FIGHTER_HOME);
    const result = await renderApp("/onboarding/role");
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
  });

  it("O05 before account registration goes to O04, keeping the intent", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/onboarding/role?intent=coach");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({ intent: "coach" });
  });

  it("role onboarding opened before account registration goes to O04 first", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/onboarding/fighter?intent=fighter");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({ intent: "fighter" });
  });

  it("Fighter onboarding is the real registration (SF-39), starting at OF1 with the intent kept", async () => {
    await signIn(ROLE_SELECTION);
    const result = await renderApp("/onboarding/fighter?intent=fighter");
    expect(await screen.findByRole("header", { name: "Your fighter profile" })).toBeOnTheScreen();
    expect(screen.queryByTestId(placeholderId("mobile.onboarding.fighter"))).toBeNull();
    await waitFor(() =>
      expect(result.getSearchParams()).toEqual({ intent: "fighter", step: "account" }),
    );
    expect(result.getPathname()).toBe("/onboarding/fighter");
  });

  it("A: a new Fighter resolved to Fighter onboarding starts at OF1, nothing created on the way", async () => {
    await signIn(FIGHTER_ONBOARDING);
    const result = await renderApp("/?intent=fighter");
    expect(await screen.findByRole("header", { name: "Your fighter profile" })).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/onboarding/fighter");
    const writes = (jest.mocked(global.fetch).mock.calls as [string, RequestInit?][]).filter(
      ([, init]) => (init?.method ?? "GET") !== "GET",
    );
    expect(writes).toEqual([]);
  });

  it("B: a partly registered Fighter resumes at the earliest missing step (OF2)", async () => {
    await signIn(FIGHTER_ONBOARDING, {
      ...FIGHTER_NOT_STARTED,
      display_name: "Alex",
      username: "alex",
      country_code: "PL",
      city: "Kraków",
      onboarding: {
        status: "in_progress",
        completed_at: null,
        missing_requirements: ["experience_level", "stance"],
      },
    });
    const result = await renderApp("/onboarding/fighter?step=notifications");
    expect(await screen.findByRole("header", { name: "Your boxing experience" })).toBeOnTheScreen();
    await waitFor(() => expect(result.getSearchParams()).toEqual({ step: "experience" }));
  });

  it("C: a completed Fighter opening an old onboarding link enters Fighter home, never OF11", async () => {
    await signIn(FIGHTER_HOME, {
      ...FIGHTER_NOT_STARTED,
      onboarding: {
        status: "completed",
        completed_at: "2026-10-09T10:00:00Z",
        missing_requirements: [],
      },
    });
    const result = await renderApp("/onboarding/fighter?step=complete");
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
    expect(screen.queryByRole("header", { name: "Your boxing journey starts here." })).toBeNull();
  });

  it("SF-41: a completed Fighter with a pending mobile first run sees the introduction first", async () => {
    await signIn(FIGHTER_HOME, FIGHTER_COMPLETED, "pending");
    const result = await renderApp("/");
    expect(
      await screen.findByRole("header", { name: "Your boxing life, mapped" }),
    ).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/welcome/tour");
  });

  it("SF-41: a finished or skipped introduction is never shown again; the Fighter home is", async () => {
    for (const status of ["completed", "dismissed"]) {
      await signIn(FIGHTER_HOME, FIGHTER_COMPLETED, status);
      const result = await renderApp("/welcome/tour");
      await waitFor(() => expect(result.getPathname()).toBe("/home"));
      expect(await screen.findByRole("header", { name: /Welcome in, Alex/ })).toBeOnTheScreen();
      await result.unmount();
    }
  });

  it("SF-41: the web tour finished does not count for the mobile introduction", async () => {
    await signIn(FIGHTER_HOME, FIGHTER_COMPLETED, "pending");
    const result = await renderApp("/home");
    await waitFor(() => expect(result.getPathname()).toBe("/welcome/tour"));
  });

  it("SF-41: without a completed Fighter onboarding the home and the introduction go to the entry", async () => {
    await signIn(ACCOUNT_REGISTRATION, FIGHTER_NOT_STARTED, "unavailable");
    const result = await renderApp("/welcome/tour");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
  });

  it("role onboarding needs no capability once account registration is complete", async () => {
    await signIn(ROLE_SELECTION);
    const result = await renderApp("/onboarding/coach");
    expect(await screen.findByRole("header", { name: "Your coach profile" })).toBeOnTheScreen();
    await act(async () => jest.runOnlyPendingTimers());
    expect(result.getPathname()).toBe("/onboarding/coach");
  });
});

/*
 * SF-53: the Coach journey on the SF-51 entry and the SF-50 profile, through
 * the real routes and gates.
 */
describe("Coach journey (SF-53)", () => {
  it("a completed Fighter choosing Coach enters Coach registration at OC1, never Fighter home", async () => {
    await signIn(
      (intent) =>
        intent === "coach"
          ? { ...COACH_ONBOARDING, fighter_profile: "completed", capabilities: ["FIGHTER"] }
          : FIGHTER_HOME,
      FIGHTER_COMPLETED,
    );
    const result = await renderApp("/?intent=coach");
    expect(await screen.findByRole("header", { name: "Your coach profile" })).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/onboarding/coach");
    await waitFor(() =>
      expect(result.getSearchParams()).toEqual({ intent: "coach", step: "profile" }),
    );
    // Nothing is created or changed on the way: the Fighter profile stays as it is.
    const writes = (jest.mocked(global.fetch).mock.calls as [string, RequestInit?][]).filter(
      ([, init]) => (init?.method ?? "GET") !== "GET",
    );
    expect(writes).toEqual([]);
  });

  it("an incomplete account registration comes first, keeping the Coach intent", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/onboarding/coach?intent=coach");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({ intent: "coach" });
  });

  it("a partly registered Coach resumes on OC2, and a stale link cannot skip ahead", async () => {
    await signIn(
      COACH_ONBOARDING,
      FIGHTER_NOT_STARTED,
      "completed",
      coachProfile({
        display_name: "Coach Sam",
        country_code: "PL",
        city: "Kraków",
      }),
    );
    const result = await renderApp("/onboarding/coach?step=complete");
    expect(await screen.findByRole("header", { name: "How do you coach?" })).toBeOnTheScreen();
    await waitFor(() => expect(result.getSearchParams()).toEqual({ step: "type" }));
  });

  it("a completed Coach opening an old registration link enters Coach today, never OC11", async () => {
    await signIn(
      COACH_HOME,
      FIGHTER_NOT_STARTED,
      "completed",
      coachProfile(
        {
          display_name: "Coach Sam",
          country_code: "PL",
          city: "Kraków",
          coaching_formats: ["online_coaching"],
        },
        true,
      ),
    );
    const result = await renderApp("/onboarding/coach?step=complete");
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
    expect(screen.queryByRole("header", { name: "Your coach profile is ready." })).toBeNull();
    expect(await screen.findByRole("header", { name: "Welcome, Coach Sam" })).toBeOnTheScreen();
  });

  it("the Coach workspace needs COACH: anyone else goes where the entry sends them", async () => {
    await signIn(ROLE_SELECTION);
    let result = await renderApp("/coach/today");
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/role"));
    expect(screen.queryByRole("header", { name: /^Welcome, / })).toBeNull();
    await result.unmount();

    await signIn(FIGHTER_HOME, FIGHTER_COMPLETED);
    result = await renderApp("/coach/fighters");
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
  });

  it("a person holding FIGHTER and COACH opens the Coach workspace whatever the last context", async () => {
    await signIn(BOTH, FIGHTER_COMPLETED, "completed", COACH_COMPLETED);
    const result = await renderApp("/coach/today");
    expect(await screen.findByRole("header", { name: "Welcome, Coach Sam" })).toBeOnTheScreen();
    await act(async () => jest.runOnlyPendingTimers());
    expect(result.getPathname()).toBe("/coach/today");
  });

  it("context_selection opens the A04 chooser, never role selection or Fighter home", async () => {
    await signIn({
      ...BOTH,
      destination: "context_selection",
      reason: "context_choice_required",
      context: null,
    });
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/workspaces"));
    expect(
      await screen.findByRole("header", { name: "Where do you want to go?" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "How will you use SimpleFit?" })).toBeNull();
    expect(screen.queryByRole("header", { name: /Welcome in/ })).toBeNull();
  });
});

/*
 * SF-87: the Gym owner journey on the SF-84 entry and the SF-83 / SF-85 gym
 * setup, through the real routes and gates.
 */
const GYM_ONBOARDING: Entry = {
  ...ROLE_SELECTION,
  destination: "gym_onboarding",
  reason: "gym_setup_not_started",
};

describe("Gym owner journey (SF-87)", () => {
  it("choosing Gym enters OG1 without a GYM_WORKSPACE, and nothing is created", async () => {
    await signIn((intent) => (intent === "gym" ? GYM_ONBOARDING : ROLE_SELECTION));
    const result = await renderApp("/?intent=gym");
    expect(await screen.findByRole("header", { name: "Gym name & type" })).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/onboarding/gym");
    await waitFor(() => expect(result.getSearchParams()).toEqual({ intent: "gym", step: "type" }));
    const writes = (jest.mocked(global.fetch).mock.calls as [string, RequestInit?][]).filter(
      ([, init]) => (init?.method ?? "GET") !== "GET",
    );
    expect(writes).toEqual([]);
  });

  it("an incomplete account registration comes first, keeping the Gym intent", async () => {
    await signIn(ACCOUNT_REGISTRATION);
    const result = await renderApp("/onboarding/gym?intent=gym");
    await waitFor(() => expect(result.getPathname()).toBe("/signup/consent"));
    expect(result.getSearchParams()).toEqual({ intent: "gym" });
  });

  it("a draft resumes at OG2 from the backend; a link cannot skip to OG6b", async () => {
    await signIn(
      { ...GYM_ONBOARDING, reason: "gym_setup_in_progress", gym_id: DRAFT_GYM.id },
      FIGHTER_NOT_STARTED,
      "completed",
      coachProfile(),
      [DRAFT_GYM],
    );
    const result = await renderApp("/onboarding/gym?step=complete");
    expect(await screen.findByRole("header", { name: "Location" })).toBeOnTheScreen();
    await waitFor(() => expect(result.getSearchParams()).toEqual({ step: "location" }));
  });

  it("a completed Fighter choosing Gym keeps the Fighter profile and writes nothing", async () => {
    await signIn(
      (intent) =>
        intent === "gym"
          ? { ...GYM_ONBOARDING, fighter_profile: "completed", capabilities: ["FIGHTER"] }
          : FIGHTER_HOME,
      FIGHTER_COMPLETED,
    );
    const result = await renderApp("/?intent=gym");
    expect(await screen.findByRole("header", { name: "Gym name & type" })).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/onboarding/gym");
    const writes = (jest.mocked(global.fetch).mock.calls as [string, RequestInit?][]).filter(
      ([, init]) => (init?.method ?? "GET") !== "GET",
    );
    expect(writes).toEqual([]);
  });

  it("with one completed gym the Gym intent opens the gym's home (gym_home)", async () => {
    await signIn({
      ...ROLE_SELECTION,
      destination: "gym_home",
      reason: "gym_workspace_completed",
      gym_id: DRAFT_GYM.id,
      capabilities: ["GYM_WORKSPACE"],
    });
    const result = await renderApp("/?intent=gym");
    // SF-89: the id-based Gym pulse of the entry's gym_id.
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${DRAFT_GYM.id}/pulse`));
  });

  it("several gyms open the gym chooser", async () => {
    await signIn({
      ...ROLE_SELECTION,
      destination: "gym_selection",
      reason: "gym_choice_required",
      capabilities: ["GYM_WORKSPACE"],
    });
    const result = await renderApp("/?intent=gym");
    await waitFor(() => expect(result.getPathname()).toBe("/gyms"));
  });
});

describe("Coach shell and context switching (SF-55)", () => {
  /**
   * A signed-in account whose entry follows the recorded context choice:
   * `PUT /api/v1/me/entry/context` stores it, `GET /api/v1/me/entry` answers
   * that context's home (or the journey of an explicit intent).
   */
  async function contexts(initial: Entry) {
    await signIn(initial, FIGHTER_COMPLETED, "completed", COACH_COMPLETED);
    let chosen: string | null = null;
    const writes: unknown[] = [];
    const reads: string[] = [];
    const answer = (intent: string | null): Entry => {
      if (intent === "coach" && initial.coach_profile !== "completed")
        return { ...initial, destination: "coach_onboarding", reason: "coach_intent", intent };
      if (chosen === "coach")
        return { ...COACH_HOME, ...BOTH, destination: "coach_home", context: "coach" };
      if (chosen === "fighter") return { ...BOTH, destination: "fighter_home", context: "fighter" };
      return initial;
    };
    mockFetch(
      jest.fn((url: string, init: RequestInit = {}) => {
        const { pathname, search } = new URL(url);
        if (pathname === "/api/v1/me/entry/context") {
          const body = JSON.parse(String(init.body)) as { context: string };
          writes.push(body);
          chosen = body.context;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (pathname === "/api/v1/me/entry") {
          reads.push(search);
          return Promise.resolve(
            jsonResponse({ entry: answer(new URLSearchParams(search).get("intent")) }),
          );
        }
        if (pathname === "/api/v1/me/fighter-profile")
          return Promise.resolve(jsonResponse({ fighter_profile: FIGHTER_COMPLETED }));
        if (pathname === "/api/v1/me/coach-profile")
          return Promise.resolve(jsonResponse({ coach_profile: COACH_COMPLETED }));
        if (pathname === "/api/v1/me/first-run")
          return Promise.resolve(jsonResponse(firstRun("completed")));
        if (pathname === "/api/v1/me/coach/fighters")
          return Promise.resolve(jsonResponse({ relationships: [], next_cursor: null }));
        return Promise.resolve(
          jsonResponse({
            user: {
              id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
              created_at: "2026-10-01T10:00:00Z",
            },
          }),
        );
      }),
    );
    return { writes, reads };
  }

  const CHOICE: Entry = {
    ...BOTH,
    destination: "context_selection",
    reason: "context_choice_required",
    context: null,
  };
  const E11: Entry = {
    ...ROLE_SELECTION,
    destination: "context_selection",
    reason: "multiple_roles_in_progress",
    fighter_profile: "in_progress",
    coach_profile: "in_progress",
    capabilities: [],
  };

  it("Coach today shows only the real CoachProfile and opens Fighters and Sessions without counts", async () => {
    await contexts(BOTH);
    await renderApp("/coach/today");
    expect(await screen.findByRole("header", { name: "Welcome, Coach Sam" })).toBeOnTheScreen();
    expect(screen.getByText("Sam Boxing · Kraków, Poland")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Coaching formats: Personal Training · Fight Camps"),
    ).toBeOnTheScreen();
    for (const fill of ["Fighters", "Sessions", "Invitations"])
      expect(screen.getByRole("link", { name: `${fill}: Open` })).toBeOnTheScreen();
    expect(
      screen.getByRole("link", {
        name: "Invite your first fighter, In Fighters · after the coach data rules",
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("link", {
        name: "Plan your first session, In Sessions · for a fighter who accepted",
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByLabelText("Coach profile, Done")).toBeOnTheScreen();
  });

  it("chooses a completed context where context_selection lands: records it, then follows the entry", async () => {
    const calls = await contexts(CHOICE);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/workspaces"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach, Coach Sam · Coach today" }),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"));
    expect(calls.writes).toEqual([{ context: "coach" }]);
    expect(await screen.findByRole("header", { name: "Welcome, Coach Sam" })).toBeOnTheScreen();
  });

  it("E11: continues an unfinished journey by intent and records nothing", async () => {
    const calls = await contexts(E11);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/workspaces"));
    expect(
      await screen.findByRole("header", { name: "Which setup do you want to continue?" }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /^Continue coach setup/ }));
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/coach"));
    expect(result.getSearchParams()).toEqual({ intent: "coach" });
    expect(calls.writes).toEqual([]);
    expect(calls.reads).toContain("?intent=coach");
  });

  it("switches from Coach today to the Fighter home through the A04 sheet", async () => {
    const calls = await contexts({ ...BOTH, destination: "coach_home", context: "coach" });
    const result = await renderApp("/coach/today");
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach Sam, Coach. Switch profile" }),
    );
    expect(
      await screen.findByRole("button", { name: "Coach, Coach Sam · Coach today" }),
    ).toBeSelected();
    await fireEvent.press(
      await screen.findByRole("button", { name: "Fighter, Alex Rivera · Fighter home" }),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
    expect(calls.writes).toEqual([{ context: "fighter" }]);
  });

  it("keeps the user in place when the choice cannot be recorded", async () => {
    await contexts(CHOICE);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/workspaces"));
    const fetchMock = global.fetch as jest.Mock;
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      new URL(url).pathname === "/api/v1/me/entry/context"
        ? Promise.resolve(jsonResponse({ error: { code: "service_unavailable" } }, { status: 503 }))
        : original?.(url, init),
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach, Coach Sam · Coach today" }),
    );
    expect(
      await screen.findByText("We couldn’t open that. Nothing changed. Try again."),
    ).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/workspaces");
  });
});

/*
 * SF-89: the gym shell of the gym in the route (`/gyms/:gymId/**`), the gym
 * rows of A04, the gym chooser and context switching, through the real
 * routes and gates against a stateful account double: the entry, the gym
 * reads and the context choice answer as the backend does (ADR 0026: 404 for
 * anyone who is not active staff of that gym, `GYM_WORKSPACE` only from a
 * completed gym).
 */
describe("Gym shell, context switching and navigation (SF-89)", () => {
  const GYM_A: GymFixture = { ...COMPLETED_GYM, name: "Ring A Boxing" };
  const GYM_B: GymFixture = {
    id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    name: "Ring B Club",
    status: "completed",
    located: false,
    role: "coach",
  };
  const FOREIGN_ID = "00000000-0000-4000-8000-00000000dead";

  type Account = {
    gyms: GymFixture[];
    fighter?: boolean;
    coach?: boolean;
    /** The last explicit context: a profile, or a gym id. */
    last?: "fighter" | "coach" | { gym: string };
    revoked?: Set<string>;
    /** Gym reads answered with this status instead of the gym. */
    status?: Record<string, number>;
    /** Gym reads that wait until released. */
    hold?: Record<string, Promise<void>>;
    /** More workspaces than the entry lists (the rest come from GET /api/v1/me/gyms). */
    unlisted?: GymFixture[];
    failChoice?: boolean;
    offlineGyms?: boolean;
  };

  const notFound = () =>
    jsonResponse(
      { error: { code: "not_found", message: "Not found", details: {}, request_id: "r" } },
      { status: 404 },
    );

  /** The account's entry now, as `GET /api/v1/me/entry` resolves it. */
  function entryOf(account: Account): Entry {
    const active = account.gyms.filter((gym) => !account.revoked?.has(gym.id));
    const completedGyms = active.filter((gym) => gym.status === "completed");
    const capabilities = [
      ...(account.fighter ? ["FIGHTER" as const] : []),
      ...(account.coach ? ["COACH" as const] : []),
      ...(completedGyms.length > 0 ? ["GYM_WORKSPACE" as const] : []),
    ];
    const last = account.last;
    const lastGym =
      typeof last === "object" ? completedGyms.find((gym) => gym.id === last.gym) : undefined;
    let destination: Entry["destination"] = "context_selection";
    let gymId: string | null = null;
    if (lastGym !== undefined) [destination, gymId] = ["gym_home", lastGym.id];
    else if (last === "fighter" && account.fighter) destination = "fighter_home";
    else if (last === "coach" && account.coach) destination = "coach_home";
    else if (capabilities.length === 1 && completedGyms.length === 1)
      [destination, gymId] = ["gym_home", completedGyms[0]!.id];
    else if (capabilities.length === 1 && account.fighter) destination = "fighter_home";
    const listed = [...completedGyms, ...active.filter((gym) => gym.status === "draft")];
    return {
      ...ROLE_SELECTION,
      destination,
      reason: "last_context",
      gym_id: gymId,
      fighter_profile: account.fighter ? "completed" : "not_started",
      coach_profile: account.coach ? "completed" : "not_started",
      capabilities,
      gym_workspaces: listed.map((gym) => ({
        ...workspaceOf(gym),
        selected: gym.id === lastGym?.id,
      })) as Entry["gym_workspaces"],
      gym_workspace_count: listed.length + (account.unlisted?.length ?? 0),
    };
  }

  async function signInAccount(account: Account) {
    const fetchMock = mockFetch(
      jest.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = new URL(url).pathname;
        if (path === "/api/v1/me/entry/context" && method === "PUT") {
          if (account.failChoice)
            return jsonResponse(
              { error: { code: "internal_error", message: "x", details: {}, request_id: "r" } },
              { status: 500 },
            );
          const body = JSON.parse(String(init?.body)) as { context: string; gym_id?: string };
          if (body.context === "gym") {
            const gym = [...account.gyms, ...(account.unlisted ?? [])].find(
              (candidate) => candidate.id === body.gym_id && !account.revoked?.has(candidate.id),
            );
            if (gym === undefined) return notFound();
            account.last = { gym: gym.id };
          } else account.last = body.context as "fighter" | "coach";
          return new Response(null, { status: 204 });
        }
        if (path === "/api/v1/me/entry") return jsonResponse({ entry: entryOf(account) });
        if (path === "/api/v1/me/gyms")
          return jsonResponse({
            gyms: [...account.gyms, ...(account.unlisted ?? [])].map(gymSummary),
            next_cursor: null,
          });
        const setup = path.match(/^\/api\/v1\/gyms\/([^/]+)\/setup$/);
        if (setup)
          return jsonResponse({ setup: gymSetup(account.gyms.find((gym) => gym.id === setup[1])) });
        const read = path.match(/^\/api\/v1\/gyms\/([^/]+)$/);
        if (read) {
          const id = read[1]!;
          await account.hold?.[id];
          if (account.offlineGyms) throw new TypeError("Network request failed");
          const status = account.status?.[id];
          if (status !== undefined)
            return jsonResponse(
              {
                error: {
                  code: status === 403 ? "forbidden" : "internal_error",
                  message: "x",
                  details: {},
                  request_id: "r",
                },
              },
              { status },
            );
          if (account.revoked?.has(id)) return notFound();
          return gymResponse(
            [...account.gyms, ...(account.unlisted ?? [])].find((gym) => gym.id === id),
          );
        }
        if (path === "/api/v1/me/fighter-profile")
          return jsonResponse({
            fighter_profile: account.fighter ? FIGHTER_COMPLETED : FIGHTER_NOT_STARTED,
          });
        if (path === "/api/v1/me/coach-profile")
          return jsonResponse({
            coach_profile: account.coach
              ? coachProfile(
                  { display_name: "Alex Coach", country_code: "PL", city: "Kraków" },
                  true,
                )
              : coachProfile(),
          });
        if (path === "/api/v1/me/first-run")
          return jsonResponse(firstRun("completed", "completed"));
        if (path === "/api/v1/me/account-profile")
          return jsonResponse({ account_profile: NOT_STARTED });
        if (/training-sessions|coaches|coach\/fighters|invitations/.test(path))
          return jsonResponse({
            training_sessions: [],
            relationships: [],
            invitations: [],
            next_cursor: null,
          });
        return jsonResponse({
          user: { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" },
        });
      }),
    );
    await completeAuthentication({
      access_token: "test-access",
      access_token_expires_at: "2099-01-01T00:00:00Z",
      refresh_token: "test-refresh",
    });
    return fetchMock;
  }

  /** The requests made, as `METHOD path` (bodies of the context choices included). */
  const requests = (fetchMock: jest.Mock) =>
    (fetchMock.mock.calls as [string, RequestInit?][]).map(([url, init]) =>
      [init?.method ?? "GET", new URL(url).pathname, init?.body ?? ""].join(" ").trim(),
    );
  const visible = { includeHiddenElements: false } as const;

  it("a cold start opens the remembered gym's Gym pulse with its real identity, nothing invented", async () => {
    await signInAccount({ gyms: [GYM_A], last: { gym: GYM_A.id } });
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_A.id}/pulse`));
    expect(await screen.findByRole("header", { name: "Gym pulse" })).toBeOnTheScreen();
    expect(screen.getAllByText("Ring A Boxing", visible).length).toBeGreaterThan(0);
    expect(screen.getByText("Boxing gym · Warsaw, Poland", visible)).toBeOnTheScreen();
    // The owner's saved setup, read for this gym.
    expect(await screen.findByText(/ul\. Ząbkowska 31/, visible)).toBeOnTheScreen();
    expect(screen.getAllByRole("text", { name: "Setup complete" }).length).toBeGreaterThan(0);
    // No fabricated metrics or unbuilt modules on screen.
    for (const fake of [
      /check-ins today/i,
      /occupancy/i,
      /failed payments/i,
      /sales/i,
      /classes today/i,
    ])
      expect(screen.queryByText(fake, visible)).toBeNull();
  });

  it("a coach at the gym sees the gym and a limited-access notice, never the owner's setup", async () => {
    const fetchMock = await signInAccount({ gyms: [GYM_B], last: { gym: GYM_B.id } });
    await renderApp(`/gyms/${GYM_B.id}/pulse`);
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Gym details", visible)).toBeNull();
    expect(requests(fetchMock).some((request) => request.includes("/setup"))).toBe(false);
  });

  it("switches Gym A → Gym B from the identity pill: the choice is recorded, B's own data shows", async () => {
    const fetchMock = await signInAccount({ gyms: [GYM_A, GYM_B], last: { gym: GYM_A.id } });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ring A Boxing, Owner. Switch gym or profile" }),
    );
    expect(
      await screen.findByRole("button", {
        name: "Ring A Boxing, Owner · Gym pulse",
        selected: true,
      }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ring B Club, Coach · Gym pulse" }));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_B.id}/pulse`));
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Ring A Boxing", visible)).toBeNull();
    expect(requests(fetchMock)).toContain(
      `PUT /api/v1/me/entry/context ${JSON.stringify({ context: "gym", gym_id: GYM_B.id })}`,
    );
  });

  it("Gym → Fighter → Gym on one account: only context choices are written", async () => {
    const fetchMock = await signInAccount({
      gyms: [GYM_A],
      fighter: true,
      last: { gym: GYM_A.id },
    });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ring A Boxing, Owner. Switch gym or profile" }),
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Fighter, Alex Rivera · Fighter home" }),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
    await act(async () => router.push("/workspaces"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ring A Boxing, Owner · Gym pulse" }),
    );
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_A.id}/pulse`));
    const writes = requests(fetchMock).filter((request) => !request.startsWith("GET"));
    expect(writes).toEqual([
      'PUT /api/v1/me/entry/context {"context":"fighter"}',
      `PUT /api/v1/me/entry/context ${JSON.stringify({ context: "gym", gym_id: GYM_A.id })}`,
    ]);
  });

  it("a gym id the user does not work at is not available, without revealing the gym", async () => {
    await signInAccount({ gyms: [GYM_A], last: { gym: GYM_A.id } });
    const result = await renderApp(`/gyms/${FOREIGN_ID}/pulse`);
    expect(
      await screen.findByRole("header", { name: "This gym isn’t available" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Gym pulse" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Your gyms" }));
    // One gym: the chooser opens it at once.
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_A.id}/pulse`));
  });

  it("a 403 on the gym read shows the role-restricted state", async () => {
    await signInAccount({ gyms: [GYM_A], last: { gym: GYM_A.id }, status: { [GYM_A.id]: 403 } });
    await renderApp(`/gyms/${GYM_A.id}/pulse`);
    expect(
      await screen.findByRole("header", { name: "Your role doesn’t include this" }),
    ).toBeOnTheScreen();
  });

  it("a draft gym never opens as a workspace; its owner continues setup", async () => {
    const draft: GymFixture = { ...DRAFT_GYM };
    await signInAccount({ gyms: [GYM_A, draft], last: { gym: GYM_A.id } });
    await renderApp(`/gyms/${draft.id}/pulse`);
    expect(
      await screen.findByRole("header", { name: "This gym isn’t set up yet" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue setup" })).toBeOnTheScreen();
  });

  it("an account without a gym workspace never enters a gym shell: the entry decides", async () => {
    await signInAccount({ gyms: [], fighter: true, last: "fighter" });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    await waitFor(() => expect(result.getPathname()).toBe("/home"));
  });

  it("a signed-out visitor of a gym link signs in first, carrying the link", async () => {
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: `/gyms/${GYM_A.id}/pulse` });
  });

  it("a membership revoked while open is noticed on the next foreground read", async () => {
    const account: Account = { gyms: [GYM_A, GYM_B], last: { gym: GYM_A.id }, revoked: new Set() };
    await signInAccount(account);
    await renderApp(`/gyms/${GYM_A.id}/pulse`);
    expect(await screen.findByRole("header", { name: "Gym pulse" })).toBeOnTheScreen();
    account.revoked!.add(GYM_A.id);
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(
      await screen.findByRole("header", { name: "This gym isn’t available" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Gym pulse" })).toBeNull();
    await act(async () => focusManager.setFocused(undefined));
  });

  it("a late answer for Gym A never shows inside Gym B", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await signInAccount({
      gyms: [GYM_A, GYM_B],
      last: { gym: GYM_A.id },
      hold: { [GYM_A.id]: held },
    });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    // Gym A's read is still out: the gate shows its pending state.
    expect(await screen.findByLabelText("Opening the gym…")).toBeOnTheScreen();
    await act(async () => router.replace(`/gyms/${GYM_B.id}/pulse`));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_B.id}/pulse`));
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible),
    ).toBeOnTheScreen();
    await act(async () => release());
    expect(screen.queryByText("Ring A Boxing", visible)).toBeNull();
    expect(screen.getAllByText("Ring B Club", visible).length).toBeGreaterThan(0);
  });

  it("the gym chooser lists gyms beyond the entry's workspaces, page by page", async () => {
    const extra: GymFixture = {
      ...GYM_B,
      id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60",
      name: "Ring C Hall",
      role: "manager",
    };
    await signInAccount({ gyms: [GYM_A, GYM_B], unlisted: [extra] });
    const result = await renderApp("/gyms");
    expect(
      await screen.findByRole("header", { name: "Which gym do you want to open?" }),
    ).toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: "Ring C Hall, Manager · Gym pulse" }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ring C Hall, Manager · Gym pulse" }));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${extra.id}/pulse`));
    expect(
      await screen.findByText(/The Manager dashboard isn’t available yet/, visible),
    ).toBeOnTheScreen();
  });

  it("a failed gym choice keeps the user where they are", async () => {
    await signInAccount({ gyms: [GYM_A, GYM_B], last: { gym: GYM_A.id }, failChoice: true });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ring A Boxing, Owner. Switch gym or profile" }),
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Ring B Club, Coach · Gym pulse" }),
    );
    expect(
      await screen.findByText(
        "We couldn’t switch. You’re still in your current profile. Try again.",
      ),
    ).toBeOnTheScreen();
    expect(result.getPathname()).toBe(`/gyms/${GYM_A.id}/pulse`);
  });

  it("offline before the first answer shows the offline state, never an empty gym", async () => {
    await signInAccount({ gyms: [GYM_A], last: { gym: GYM_A.id }, offlineGyms: true });
    await renderApp(`/gyms/${GYM_A.id}/pulse`);
    expect(await screen.findByText("You’re offline")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Gym pulse" })).toBeNull();
  });

  it("signing out and in as another account shows only that account's gym", async () => {
    await signInAccount({ gyms: [GYM_A], last: { gym: GYM_A.id } });
    const result = await renderApp(`/gyms/${GYM_A.id}/pulse`);
    expect(await screen.findByRole("header", { name: "Gym pulse" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(result.getPathname()).toBe("/settings"));
    await fireEvent.press(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"));
    await signInAccount({ gyms: [GYM_B], last: { gym: GYM_B.id } });
    await act(async () => router.replace("/"));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${GYM_B.id}/pulse`));
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Ring A Boxing", visible)).toBeNull();
  });
});
