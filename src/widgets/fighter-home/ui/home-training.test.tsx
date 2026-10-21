import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { completeAuthentication, onSessionBoundary } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { myTrainingSessionsRootKey } from "@/entities/training-session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { HomeTraining } from "./home-training";

/*
 * The Home's Training card (SF-69) on the SF-63 projections, with the
 * network mocked at `fetch`: the next session is the backend's first
 * upcoming one, the preview is its newest completed ones, nothing is
 * counted, a failed read is never an empty schedule, each projection fails
 * on its own, nothing is ever written, and a previous account's late answer
 * never reaches the next account's Home.
 */

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "5d0c1f5e-1111-4a1b-9c1d-000000000001",
  relationship_id: "rel-1",
  coach: { display_name: "Julia Nowak", brand_name: "North Gym" },
  coach_display_name_at_end: null,
  title: "Technical boxing",
  training_type: "technical",
  starts_at: "2026-10-21T16:00:00Z",
  time_zone: "Europe/Warsaw",
  duration_minutes: 60,
  notes: null,
  status: "planned",
  completed_at: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  inserted_at: "2026-10-20T10:00:00Z",
  updated_at: "2026-10-20T10:00:00Z",
  ...overrides,
});
const page = (training_sessions: unknown[], next_cursor: string | null = null) =>
  jsonResponse({ training_sessions, next_cursor });
const failure = (status: number, code: string) =>
  jsonResponse({ error: { code, message: "", details: {}, request_id: "r" } }, { status });

type Reply = (token: string) => Response | Promise<Response>;
function backend({ upcoming, completed }: { upcoming: Reply; completed: Reply }) {
  const calls: string[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname, searchParams, search } = new URL(url);
      const method = init.method ?? "GET";
      calls.push(`${method} ${pathname}${search}`);
      const token = new Headers(init.headers).get("authorization") ?? "";
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (pathname === "/api/v1/me/training-sessions")
        return Promise.resolve(
          searchParams.get("view") === "upcoming" ? upcoming(token) : completed(token),
        );
      throw new Error(`unexpected ${method} ${pathname}`);
    }),
  );
  return calls;
}

const user = userEvent.setup();
const signIn = (token: string) =>
  completeAuthentication({
    access_token: token,
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: `${token}-refresh`,
  });

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.push.mockClear();
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await signIn("sfa_alex");
});

describe("Home Training card (SF-69)", () => {
  it("shows the backend's first upcoming session and the newest completed ones, with no counts", async () => {
    const calls = backend({
      upcoming: () =>
        page(
          [
            session(),
            session({ id: "later", title: "Later pads", starts_at: "2026-10-25T16:00:00Z" }),
          ],
          "more",
        ),
      completed: () =>
        page([
          session({ id: "c1", title: "Roadwork", training_type: "roadwork", status: "completed" }),
          session({
            id: "c2",
            title: "Pads",
            status: "completed",
            coach: null,
            coach_display_name_at_end: "Tomasz M.",
          }),
          session({ id: "c3", title: "S&C", status: "completed" }),
          session({ id: "c4", title: "Fourth", status: "completed" }),
        ]),
    });
    await renderWithProviders(<HomeTraining />);

    const next = await screen.findByTestId(`home:training:next:${session().id}`);
    expect(within(next).getByText("06:00 PM")).toBeOnTheScreen();
    expect(within(next).getByText("Wed, Oct 21 · Warsaw")).toBeOnTheScreen();
    expect(
      within(next).getByText("Technical · Julia Nowak · North Gym · 60 min"),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Later pads")).toBeNull();
    expect(await screen.findByTestId("home:training:recent:c1")).toBeOnTheScreen();
    expect(screen.getByTestId("home:training:recent:c3")).toBeOnTheScreen();
    expect(screen.queryByText("Fourth")).toBeNull();
    expect(
      within(screen.getByTestId("home:training:recent:c2")).getByText(/Former coach · Tomasz M\./),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/\d+ (sessions|upcoming|completed)/i)).toBeNull();

    await user.press(next);
    expect(mockRouter.push).toHaveBeenCalledWith(`/sessions/${session().id}`);
    await user.press(screen.getByTestId("home:training:recent:c1"));
    expect(mockRouter.push).toHaveBeenLastCalledWith("/sessions/c1");
    await user.press(screen.getByRole("link", { name: "All training" }));
    expect(mockRouter.push).toHaveBeenLastCalledWith("/training");
    expect(calls).toEqual(
      expect.arrayContaining([
        "GET /api/v1/me/training-sessions?view=upcoming&limit=50",
        "GET /api/v1/me/training-sessions?view=history&status=completed&limit=50",
      ]),
    );
    expect(calls.filter((call) => !call.startsWith("GET"))).toEqual([]);
  });

  it("says when nothing is scheduled or completed, never a sample session", async () => {
    backend({ upcoming: () => page([]), completed: () => page([]) });
    await renderWithProviders(<HomeTraining />);
    expect(await screen.findByText("No training scheduled yet")).toBeOnTheScreen();
    expect(await screen.findByText("No completed sessions yet.")).toBeOnTheScreen();
  });

  it("keeps the completed preview when upcoming fails, and retries upcoming alone", async () => {
    let attempt = 0;
    backend({
      upcoming: () => (++attempt === 1 ? failure(503, "internal_error") : page([session()])),
      completed: () => page([session({ id: "c1", title: "Roadwork", status: "completed" })]),
    });
    await renderWithProviders(<HomeTraining />);
    expect(await screen.findByTestId("home:training:failed")).toBeOnTheScreen();
    expect(screen.queryByText("No training scheduled yet")).toBeNull();
    expect(await screen.findByTestId("home:training:recent:c1")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId(`home:training:next:${session().id}`)).toBeOnTheScreen();
  });

  it("keeps the next session when the completed preview fails", async () => {
    backend({ upcoming: () => page([session()]), completed: () => failure(500, "internal_error") });
    await renderWithProviders(<HomeTraining />);
    expect(await screen.findByTestId(`home:training:next:${session().id}`)).toBeOnTheScreen();
    expect(await screen.findByTestId("home:training:recent:failed")).toBeOnTheScreen();
    expect(screen.queryByText("No completed sessions yet.")).toBeNull();
  });

  it("not available (404) is one state, never an empty schedule", async () => {
    backend({
      upcoming: () => failure(404, "not_found"),
      completed: () => failure(404, "not_found"),
    });
    await renderWithProviders(<HomeTraining />);
    expect(await screen.findByTestId("home:training:unavailable")).toBeOnTheScreen();
    expect(screen.queryByText("No training scheduled yet")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("follows the backend after a completion or cancellation elsewhere (shared lists invalidated)", async () => {
    let changed = false;
    backend({
      upcoming: () => page(changed ? [session({ id: "d3", title: "Sparring" })] : [session()]),
      completed: () =>
        page(
          changed ? [session({ status: "completed", completed_at: "2026-10-21T17:00:00Z" })] : [],
        ),
    });
    const { queryClient } = await renderWithProviders(<HomeTraining />);
    expect(await screen.findByTestId(`home:training:next:${session().id}`)).toBeOnTheScreen();
    changed = true;
    await act(() => queryClient.invalidateQueries({ queryKey: myTrainingSessionsRootKey }));
    expect(await screen.findByTestId("home:training:next:d3")).toBeOnTheScreen();
    expect(await screen.findByTestId(`home:training:recent:${session().id}`)).toBeOnTheScreen();
  });

  it("a previous account's late answer never reaches the next account's Home", async () => {
    let releaseAlex: (() => void) | undefined;
    backend({
      upcoming: (token) =>
        token === "Bearer sfa_alex"
          ? new Promise<Response>((resolve) => {
              releaseAlex = () => resolve(page([session({ id: "alex-1", title: "Alex secret" })]));
            })
          : page([session({ id: "julia-1", title: "Julia footwork" })]),
      completed: () => page([]),
    });
    const { queryClient: client, rerender } = await renderWithProviders(
      <HomeTraining key="alex" />,
    );
    // As the app's session-scoped cache does (SF-28, providers/session-cache).
    const stop = onSessionBoundary(() => {
      void client.cancelQueries();
      client.clear();
    });
    await waitFor(() => expect(releaseAlex).toBeDefined());

    await act(() => signIn("sfa_julia"));
    await act(async () => {
      releaseAlex?.();
      await Promise.resolve();
    });
    // Alex's answer arrived after the boundary: nothing of it is shown or kept.
    expect(screen.queryByText("Alex secret")).toBeNull();
    // The new account's screens mount afresh (the gates replace the tree on a sign-in).
    await rerender(<HomeTraining key="julia" />);
    expect(await screen.findByTestId("home:training:next:julia-1")).toBeOnTheScreen();
    expect(screen.queryByText("Alex secret")).toBeNull();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain("Alex secret");
    stop();
  });
});
