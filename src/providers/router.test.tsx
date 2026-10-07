import { readFileSync } from "node:fs";

import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { startSession } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { setSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch } from "@/test/render";
import { mobileRoutes } from "@/shared/routes/mobile-routes";
import type { MobileRoute } from "@/shared/routes/routes";

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

/** Renders the app at `url`; the result also reads the router's current location. */
async function renderApp(url: string) {
  const result = renderRouter(
    { appDir: "src/app", overrides: { _layout: TestRootLayout } },
    { initialUrl: url },
  );
  // Testing Library's render is asynchronous; renderRouter attaches its readers to the promise.
  const rendered = await result;
  return {
    ...rendered,
    getPathname: result.getPathname,
    getSearchParams: result.getSearchParams,
  };
}

async function signIn() {
  await startSession({ access_token: "test-access", refresh_token: "test-refresh" });
}

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
      if (route.session === "AUTHENTICATED") await signIn();
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
    await signIn();
    const result = await renderApp("/gym/g-42/classes/c-7/book");
    expect(
      await screen.findByTestId(placeholderId("mobile.gym._gym-id.classes._class-id.book")),
    ).toBeOnTheScreen();
    expect(result.getSearchParams()).toEqual({ gymId: "g-42", classId: "c-7" });
  });

  it("serves fighter and workspace routes that share the /gym and /coach prefixes", async () => {
    await signIn();
    await renderApp("/gym/pulse");
    expect(await screen.findByTestId(placeholderId("mobile.gym.pulse"))).toBeOnTheScreen();
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

describe("session access (UX only)", () => {
  it("sends a signed-out visitor of a signed-in route to sign-in with returnTo", async () => {
    const result = await renderApp("/camp/weight");
    await waitFor(() => expect(result.getPathname()).toBe("/login"));
    expect(result.getSearchParams()).toEqual({ returnTo: "/camp/weight" });
    expect(await screen.findByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
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

  it("opens every capability's routes for any signed-in user (no invented capability state)", async () => {
    await signIn();
    for (const url of ["/home", "/coach/today", "/gym/pulse", "/onboarding/fighter"]) {
      const result = await renderApp(url);
      await waitFor(() => expect(result.getPathname()).toBe(url));
      await result.unmount();
    }
  });
});

describe("tab navigation", () => {
  it("shows the fighter tabs with the current tab selected, and switches tabs", async () => {
    await signIn();
    const result = await renderApp("/home");
    expect(await screen.findByRole("tab", { name: "Home", selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText("Fighter navigation")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Training" }));
    await waitFor(() => expect(result.getPathname()).toBe("/training"));
    expect(await screen.findByRole("tab", { name: "Training", selected: true })).toBeOnTheScreen();
  });

  it("pushes the coach Inbox (shared /messages) above the coach tabs", async () => {
    await signIn();
    const result = await renderApp("/coach/today");
    await fireEvent.press(await screen.findByRole("tab", { name: "Inbox" }));
    await waitFor(() => expect(result.getPathname()).toBe("/messages"));
    expect(await screen.findByTestId(placeholderId("mobile.messages"))).toBeOnTheScreen();
  });

  it("selects the gym tab of every gym tab route", async () => {
    await signIn();
    for (const [url, tab] of [
      ["/gym/check-in", "QR check-in"],
      ["/gym/staff/on-shift", "Staff"],
    ] as const) {
      const result = await renderApp(url);
      expect(await screen.findByRole("tab", { name: tab, selected: true })).toBeOnTheScreen();
      await result.unmount();
    }
  });

  it("keeps the tab bar on the screens the design shows inside a tab, with that tab active", async () => {
    await signIn();
    for (const [url, tab] of [
      ["/progress", "Profile"],
      ["/calendar", "Training"],
      ["/marketplace", "Community"],
      ["/coach/sparring", "Requests"],
      ["/coach/challenge/c-1", "Today"],
      ["/gym/members/m-1", "Members"],
      ["/gym/classes/c-1/roster", "Classes"],
    ] as const) {
      const result = await renderApp(url);
      expect(await screen.findByRole("tab", { name: tab, selected: true })).toBeOnTheScreen();
      expect(result.getPathname()).toBe(url);
      await result.unmount();
    }
  });

  it("returns from a tab section to its tab root", async () => {
    await signIn();
    const result = await renderApp("/progress");
    await screen.findByRole("tab", { name: "Profile", selected: true });
    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/profile"));
    expect(await screen.findByRole("tab", { name: "Profile", selected: true })).toBeOnTheScreen();
  });

  it("pushes detail screens above the tabs, without the tab bar", async () => {
    await signIn();
    await renderApp("/camp/weight");
    await screen.findByTestId(placeholderId("mobile.camp.weight"));
    expect(screen.queryByRole("tab", { name: "Home" })).toBeNull();
  });

  it("goes back from a pushed screen to the tab it was opened from", async () => {
    await signIn();
    const result = await renderApp("/profile");
    await screen.findByTestId(placeholderId("mobile.profile"));
    await act(async () => router.push("/achievements"));
    await waitFor(() => expect(result.getPathname()).toBe("/achievements"));
    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/profile"));
  });

  it("keeps the tabs underneath a deep-linked pushed screen", async () => {
    await signIn();
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
  it("covers a gated route with the LD1 launch screen while the session is restored, in the same navigator", async () => {
    await setSecureItem("simplefit.session.refresh_token", "stored-refresh");
    let respond: (response: Response) => void = () => {};
    mockFetch(jest.fn(() => new Promise<Response>((resolve) => (respond = resolve))));

    const result = await renderApp("/home");
    expect(await screen.findByLabelText("Loading SimpleFit")).toBeOnTheScreen();
    expect(result.getPathname()).toBe("/home");

    await act(async () =>
      respond(
        jsonResponse({
          access_token: "fresh-access",
          refresh_token: "fresh-refresh",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token_transport: "body",
        }),
      ),
    );
    expect(await screen.findByTestId(placeholderId("mobile.home"))).toBeOnTheScreen();
    expect(screen.queryByLabelText("Loading SimpleFit")).toBeNull();
    expect(result.getPathname()).toBe("/home");
  });

  it("renders the root error boundary without the error's details", async () => {
    // React logs caught errors in development; this one is thrown on purpose.
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("db password=hunter2");
    }
    const result = renderRouter(
      {
        appDir: "src/app",
        overrides: { _layout: { default: TestRootLayout, ErrorBoundary }, boom: Boom },
      },
      { initialUrl: "/boom" },
    );
    await result;
    expect(await screen.findByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.queryByText(/hunter2/)).toBeNull();
    log.mockRestore();
  });
});
