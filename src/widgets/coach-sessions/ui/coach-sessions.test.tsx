import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { getCalendars } from "expo-localization";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { CoachTrainingSession } from "@/entities/training-session";
import { catalogs } from "@/shared/i18n/messages";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { CoachSessionEditScreen } from "./coach-session-editor";
import { CoachSessionScreen } from "./coach-session-screen";
import { CoachSessionsScreen } from "./coach-sessions-screen";

/*
 * CT1 Sessions, CT3 Session and CT4 Edit (SF-65) on the SF-62 / SF-63 coach
 * endpoints, the network mocked at `fetch`. Only the backend's projections
 * and statuses are shown; unavailable (404) is never an empty list; nothing
 * is shown as cancelled before the backend answers.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const SESSIONS = "/api/v1/me/coach/training-sessions";
const ID = "5d1c2b3a-2222-4c8a-9d1e-000000000001";

const session = (extra: Partial<CoachTrainingSession> = {}): CoachTrainingSession => ({
  id: ID,
  relationship_id: "0b9f1f7e-1111-4c8a-9d1e-000000000001",
  fighter: { display_name: "Alex Kowal", username: "alex_k" },
  title: "Pads with coach",
  training_type: "pads",
  starts_at: "2026-10-21T16:00:00Z",
  time_zone: "Europe/Warsaw",
  duration_minutes: 75,
  notes: "Jab work.",
  status: "planned",
  completed_at: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  inserted_at: "2026-10-20T09:00:00Z",
  updated_at: "2026-10-20T09:00:00Z",
  ...extra,
});

type Call = { method: string; path: string; query: URLSearchParams };
type Reply = Response | ((call: Call) => Response);

function backend(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const parsed = new URL(url);
      const call = {
        method: (init.method ?? "GET").toUpperCase(),
        path: parsed.pathname,
        query: parsed.searchParams,
      };
      calls.push(call);
      if (call.path === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      const reply = routes[`${call.method} ${call.path}`];
      if (reply === undefined) throw new Error(`unexpected ${call.method} ${call.path}`);
      return Promise.resolve(typeof reply === "function" ? reply(call) : reply.clone());
    }),
  );
  return calls;
}
const list = (items: unknown[], next_cursor: string | null = null) =>
  jsonResponse({ training_sessions: items, next_cursor });
const one = (item: CoachTrainingSession) => jsonResponse({ training_session: item });
const error = (status: number, code: string) =>
  jsonResponse({ error: { code, message: "x", details: {}, request_id: "r" } }, { status });

const user = userEvent.setup();

beforeEach(async () => {
  resetSessionForTests();
  jest.clearAllMocks();
  jest.mocked(getCalendars).mockReturnValue([{ timeZone: "Europe/Warsaw" }] as never);
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Sessions (CT1)", () => {
  it("lists the upcoming projection grouped by day in each session's own zone", async () => {
    const lisbon = session({
      id: "5d1c2b3a-2222-4c8a-9d1e-000000000002",
      title: "Sparring rounds",
      training_type: "sparring",
      fighter: null,
      starts_at: "2026-10-25T16:00:00Z",
      time_zone: "Europe/Lisbon",
    });
    const calls = backend({ [`GET ${SESSIONS}`]: list([session(), lisbon]) });
    await renderWithProviders(<CoachSessionsScreen view="upcoming" filter="all" />);
    const row = await screen.findByRole("button", {
      name: "Pads with coach, 06:00 PM Europe/Warsaw, Pads · Alex Kowal · 75 min, Planned",
    });
    expect(screen.getByRole("header", { name: "Wed, Oct 21, 2026" })).toBeOnTheScreen();
    // Lisbon is back on UTC+00:00 that day (clocks went back at 01:00 UTC): 16:00.
    expect(
      screen.getByRole("button", {
        name: /^Sparring rounds, 04:00 PM Europe\/Lisbon, Sparring · Fighter not shared/,
      }),
    ).toBeOnTheScreen();
    expect(calls.find((call) => call.path === SESSIONS)?.query.get("view")).toBe("upcoming");
    await user.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith(`/coach/sessions/${ID}`);
  });

  it("tells empty apart from unavailable (sharing off) and from a failure", async () => {
    backend({ [`GET ${SESSIONS}`]: list([]) });
    const first = await renderWithProviders(<CoachSessionsScreen view="upcoming" filter="all" />);
    expect(await screen.findByText("No upcoming sessions")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "New session" })).toBeEnabled();
    await first.unmount();

    backend({ [`GET ${SESSIONS}`]: error(404, "not_found") });
    const second = await renderWithProviders(<CoachSessionsScreen view="upcoming" filter="all" />);
    expect(await screen.findByText("Sessions aren’t available yet")).toBeOnTheScreen();
    expect(screen.queryByText("No upcoming sessions")).toBeNull();
    expect(screen.getByRole("button", { name: "New session" })).toBeDisabled();
    await second.unmount();

    let fail = true;
    backend({
      [`GET ${SESSIONS}`]: () => (fail ? error(500, "internal_error") : list([session()])),
    });
    await renderWithProviders(<CoachSessionsScreen view="upcoming" filter="all" />);
    expect(await screen.findByText(/We couldn’t load your sessions\./)).toBeOnTheScreen();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Pads with coach")).toBeOnTheScreen();
  });

  it("asks the backend for history narrowed to a status, keeps a past-due planned one planned, and pages", async () => {
    const completed = session({ status: "completed", completed_at: "2026-10-21T18:00:00Z" });
    const pastDue = session({ id: "5d1c2b3a-2222-4c8a-9d1e-000000000003", title: "S&C circuit" });
    const calls = backend({
      [`GET ${SESSIONS}`]: ({ query }) =>
        query.get("cursor") === "c2" ? list([pastDue]) : list([completed], "c2"),
    });
    await renderWithProviders(<CoachSessionsScreen view="history" filter="completed" />);
    expect(
      await screen.findByRole("button", { name: /Pads with coach.*Completed$/ }),
    ).toBeOnTheScreen();
    const first = calls.find((call) => call.path === SESSIONS);
    expect(first?.query.get("view")).toBe("history");
    expect(first?.query.get("status")).toBe("completed");
    await user.press(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("button", { name: /S&C circuit.*Planned$/ })).toBeOnTheScreen();
    expect(
      calls.filter((call) => call.path === SESSIONS).map((c) => c.query.get("cursor")),
    ).toEqual(expect.arrayContaining([null, "c2"]));

    await user.press(screen.getByRole("radio", { name: "Cancelled" }));
    expect(mockRouter.replace).toHaveBeenCalledWith(
      "/coach/sessions?view=history&status=cancelled",
    );
    await user.press(screen.getByRole("tab", { name: "Upcoming" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/coach/sessions");
  });
});

describe("Session (CT3)", () => {
  it("shows a planned session in its zone and the viewer's, with Edit and Cancel", async () => {
    jest.mocked(getCalendars).mockReturnValue([{ timeZone: "America/New_York" }] as never);
    backend({ [`GET ${SESSIONS}/${ID}`]: one(session()) });
    await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    expect(await screen.findByRole("header", { name: "Pads with coach" })).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /^Starts: Wed, Oct 21, 2026, 06:00 PM · Europe\/Warsaw \(UTC\+02:00\)$/,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Your time: Wed, Oct 21, 2026, 12:00 PM · America\/New_York$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Duration: 75 min")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Edit" }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/coach/sessions/${ID}/edit`);
  });

  it("is read-only once completed, and names who cancelled", async () => {
    backend({
      [`GET ${SESSIONS}/${ID}`]: one(
        session({ status: "completed", completed_at: "2026-10-21T17:20:00Z" }),
      ),
    });
    const first = await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    expect(
      await screen.findByLabelText(/^Completed: Wed, Oct 21, 2026, 07:20 PM$/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel session" })).toBeNull();
    await first.unmount();

    backend({
      [`GET ${SESSIONS}/${ID}`]: one(
        session({
          status: "cancelled",
          cancelled_at: "2026-10-20T07:12:00Z",
          cancelled_by: "system",
          cancel_reason: "relationship_ended",
          fighter: null,
        }),
      ),
    });
    await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    expect(
      await screen.findByLabelText(/^Cancelled: .* · the coaching relationship ended$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Fighter: Fighter not shared")).toBeOnTheScreen();
  });

  it("cancels only after confirmation, with one request, and shows only the backend's answer", async () => {
    let current = session();
    const calls = backend({
      [`GET ${SESSIONS}/${ID}`]: () => one(current),
      [`POST ${SESSIONS}/${ID}/cancel`]: () => {
        current = session({
          status: "cancelled",
          cancelled_at: "2026-10-20T10:00:00Z",
          cancelled_by: "coach",
        });
        return one(current);
      },
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Cancel session" }));
    expect(await screen.findByText(/Alex Kowal sees it as cancelled\./)).toBeOnTheScreen();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    const confirm = screen.getAllByRole("button", { name: "Cancel session" }).at(-1);
    if (confirm === undefined) throw new Error("no confirm button");
    await user.press(confirm);
    expect(await screen.findByText("The session is cancelled.")).toBeOnTheScreen();
    expect(await screen.findByLabelText(/^Cancelled: .* · by you$/)).toBeOnTheScreen();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("reports a session the fighter completed meanwhile (409) without calling it cancelled", async () => {
    let current = session();
    backend({
      [`GET ${SESSIONS}/${ID}`]: () => one(current),
      [`POST ${SESSIONS}/${ID}/cancel`]: () => {
        current = session({ status: "completed", completed_at: "2026-10-20T10:00:00Z" });
        return error(409, "conflict");
      },
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Cancel session" }));
    const confirm = (await screen.findAllByRole("button", { name: "Cancel session" })).at(-1);
    if (confirm === undefined) throw new Error("no confirm button");
    await user.press(confirm);
    expect(
      await screen.findByText(
        "This session can’t be cancelled any more: the fighter completed it.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("The session is cancelled.")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("session:completed")).toBeOnTheScreen());
  });

  it("shows unknown, foreign and malformed ids as not available, never sending a malformed one", async () => {
    const calls = backend({ [`GET ${SESSIONS}/${ID}`]: error(404, "not_found") });
    const first = await renderWithProviders(<CoachSessionScreen sessionId={ID} />);
    expect(await screen.findByText("This session isn’t available")).toBeOnTheScreen();
    await first.unmount();

    await renderWithProviders(<CoachSessionScreen sessionId="../fighters" />);
    expect(await screen.findByText("This session isn’t available")).toBeOnTheScreen();
    expect(calls.some((call) => call.path.includes("fighters"))).toBe(false);
  });
});

describe("Edit session (CT4) screen", () => {
  it("gives a terminal session no form", async () => {
    backend({
      [`GET ${SESSIONS}/${ID}`]: one(
        session({
          status: "cancelled",
          cancelled_by: "coach",
          cancelled_at: "2026-10-20T10:00:00Z",
        }),
      ),
    });
    await renderWithProviders(<CoachSessionEditScreen sessionId={ID} />);
    expect(await screen.findByText(/This session can’t be changed any more\./)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});

describe("Edit session (CT4) save", () => {
  it("returns to the session after the backend saved it", async () => {
    let current = session();
    backend({
      [`GET ${SESSIONS}/${ID}`]: () => one(current),
      [`PATCH ${SESSIONS}/${ID}`]: () => {
        current = session({ duration_minutes: 90, updated_at: "2026-10-20T11:00:00Z" });
        return one(current);
      },
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<CoachSessionEditScreen sessionId={ID} />);
    const duration = await screen.findByLabelText("Duration");
    await user.clear(duration);
    await user.type(duration, "90");
    await user.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await screen.findByText("Changes saved.")).toBeOnTheScreen();
  });
});

describe("Sessions copy", () => {
  it("uses no ICU plural or select: Hermes on iOS has no Intl.PluralRules", () => {
    const flagged = Object.entries(catalogs).filter(([, catalog]) =>
      /\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(
        JSON.stringify((catalog as { coachSessions?: unknown }).coachSessions ?? {}),
      ),
    );
    expect(flagged.map(([locale]) => locale)).toEqual([]);
  });
});
