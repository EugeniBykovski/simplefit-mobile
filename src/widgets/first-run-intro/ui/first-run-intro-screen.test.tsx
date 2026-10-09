import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { FirstRunIntroScreen } from "./first-run-intro-screen";

/*
 * The Fighter mobile introduction (SF-41, FR1–FR3) on the SF-40 first-run
 * API, with the network mocked at `fetch`. The backend owns the outcome;
 * these check what is sent, what is shown and where the screen goes.
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
const LIST = "/api/v1/me/first-run";
const MOBILE = `${LIST}/fighter_mobile_first_run`;

type Status = "unavailable" | "pending" | "completed" | "dismissed";

/** A fake SF-40 backend: the first outcome recorded is kept; `fail` makes the next PUT fail. */
function backend(initial: Status, options: { fail?: boolean; keptElsewhere?: Status } = {}) {
  let mobile: Status = initial;
  const fetchMock = mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      const method = init.method ?? "GET";
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (method === "GET" && pathname === LIST)
        return Promise.resolve(
          jsonResponse({
            experiences: [
              { experience: "fighter_web_tour", status: "pending", recorded_at: null },
              { experience: "fighter_mobile_first_run", status: mobile, recorded_at: null },
            ],
          }),
        );
      if (method === "PUT" && pathname === MOBILE) {
        if (options.fail === true) {
          options.fail = false;
          return Promise.reject(new TypeError("Network request failed"));
        }
        const { outcome } = JSON.parse(String(init.body)) as { outcome: Status };
        if (mobile === "pending") mobile = options.keptElsewhere ?? outcome;
        return Promise.resolve(
          jsonResponse({
            experience: {
              experience: "fighter_mobile_first_run",
              status: mobile,
              recorded_at: "2026-10-09T10:00:00Z",
            },
          }),
        );
      }
      throw new Error(`unexpected request ${method} ${pathname}`);
    }),
  );
  return {
    puts: () =>
      (fetchMock.mock.calls as [string, RequestInit?][])
        .filter(([, init]) => init?.method === "PUT")
        .map(([url, init]) => ({
          path: new URL(url).pathname,
          body: JSON.parse(String(init?.body)) as unknown,
        })),
  };
}

const user = userEvent.setup();
const heading = (name: string) => screen.findByRole("header", { name });

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.replace.mockClear();
  mockRedirects.length = 0;
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Fighter mobile introduction (FR1–FR3)", () => {
  it("walks the three slides in order and records completed only on “Let’s go”", async () => {
    const api = backend("pending");
    await renderWithProviders(<FirstRunIntroScreen />);

    expect(await heading("Your boxing life, mapped")).toBeOnTheScreen();
    expect(screen.getByLabelText("Intro 1 of 3")).toHaveAccessibilityValue({
      min: 1,
      max: 3,
      now: 1,
    });
    // The illustration is one described image; it names no one.
    expect(screen.getByRole("image", { name: /An example Live Board/ })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Next" }));
    expect(await heading("Rounds, not reps")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Next" }));
    expect(await heading("Your coach and gym, in your pocket")).toBeOnTheScreen();
    expect(api.puts()).toEqual([]);

    await user.press(screen.getByRole("button", { name: "Let’s go" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/home"));
    expect(api.puts()).toEqual([{ path: MOBILE, body: { outcome: "completed" } }]);
  });

  it("records dismissed on “Skip intro” and goes home", async () => {
    const api = backend("pending");
    await renderWithProviders(<FirstRunIntroScreen />);
    await heading("Your boxing life, mapped");
    await user.press(screen.getByRole("button", { name: "Skip intro" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/home"));
    expect(api.puts()).toEqual([{ path: MOBILE, body: { outcome: "dismissed" } }]);
  });

  it("stays with a retry when the outcome cannot be saved, and never moves on", async () => {
    const api = backend("pending", { fail: true });
    await renderWithProviders(<FirstRunIntroScreen />);
    await heading("Your boxing life, mapped");
    await user.press(screen.getByRole("button", { name: "Skip intro" }));
    expect(await screen.findByText(/couldn’t save that/)).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await user.press(screen.getByRole("button", { name: "Skip intro" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/home"));
    expect(api.puts()).toHaveLength(2);
  });

  it("goes home with the outcome another device recorded first", async () => {
    const api = backend("pending", { keptElsewhere: "dismissed" });
    await renderWithProviders(<FirstRunIntroScreen />);
    await heading("Your boxing life, mapped");
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(screen.getByRole("button", { name: "Next" }));
    await user.press(screen.getByRole("button", { name: "Let’s go" }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/home"));
    expect(api.puts()).toHaveLength(1);
  });

  it.each(["completed", "dismissed"] as const)(
    "never shows again once %s: it goes to the home",
    async (status) => {
      backend(status);
      await renderWithProviders(<FirstRunIntroScreen />);
      await waitFor(() => expect(mockRedirects).toContain("/home"));
      expect(screen.queryByRole("header")).toBeNull();
    },
  );

  it("sends a Fighter without completed onboarding to the entry", async () => {
    backend("unavailable");
    await renderWithProviders(<FirstRunIntroScreen />);
    await waitFor(() => expect(mockRedirects).toContain("/"));
  });

  it("walks back with Android Back", async () => {
    type Listener = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: Listener[] = [];
    const spy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        handlers.push(handler);
        return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
      });
    backend("pending");
    await renderWithProviders(<FirstRunIntroScreen />);
    await heading("Your boxing life, mapped");
    await user.press(screen.getByRole("button", { name: "Next" }));
    await heading("Rounds, not reps");
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = handlers.at(-1)?.({} as Parameters<Listener>[0]);
    });
    expect(handled).toBe(true);
    expect(await heading("Your boxing life, mapped")).toBeOnTheScreen();
    spy.mockRestore();
  });
});
