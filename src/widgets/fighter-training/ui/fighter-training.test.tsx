import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { getCalendars } from "expo-localization";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { MyTrainingSession } from "@/entities/training-session";
import { catalogs } from "@/shared/i18n/messages";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { FighterSessionScreen } from "./fighter-session-screen";
import { FighterTrainingScreen } from "./fighter-training-screen";

/*
 * FT1 Training and FT2 Session (SF-66) on the SF-62 / SF-63 fighter
 * endpoints, the network mocked at `fetch`. Only the backend's projections,
 * statuses and completion time are shown; completion is one explicit request
 * after a confirmation, and a refusal or an unknown outcome never shows as
 * completed.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const SESSIONS = "/api/v1/me/training-sessions";
const ID = "5d1c2b3a-2222-4c8a-9d1e-000000000001";

const session = (extra: Partial<MyTrainingSession> = {}): MyTrainingSession => ({
  id: ID,
  relationship_id: "0b9f1f7e-1111-4c8a-9d1e-000000000001",
  coach: { display_name: "Coach Marek", brand_name: "Marek Boxing" },
  coach_display_name_at_end: null,
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

type Call = { method: string; path: string; query: URLSearchParams; body: unknown };
type Reply = Response | ((call: Call) => Response | Promise<Response>);

function backend(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const parsed = new URL(url);
      const call = {
        method: (init.method ?? "GET").toUpperCase(),
        path: parsed.pathname,
        query: parsed.searchParams,
        body: init.body,
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
const one = (item: MyTrainingSession) => jsonResponse({ training_session: item });
const error = (status: number, code: string, details: Record<string, unknown> = {}) =>
  jsonResponse({ error: { code, message: "x", details, request_id: "r" } }, { status });
const posts = (calls: Call[]) => calls.filter((call) => call.method === "POST");

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

describe("Training (FT1)", () => {
  it("lists the upcoming projection with each coach, also a former one, by day in each zone", async () => {
    const former = session({
      id: "5d1c2b3a-2222-4c8a-9d1e-000000000002",
      title: "Roadwork intervals",
      training_type: "roadwork",
      coach: null,
      coach_display_name_at_end: "Sam R.",
      starts_at: "2026-10-24T08:30:00Z",
    });
    const calls = backend({ [`GET ${SESSIONS}`]: list([session(), former]) });
    await renderWithProviders(<FighterTrainingScreen view="upcoming" filter="all" />);
    const row = await screen.findByRole("button", {
      name: "Pads with coach, 06:00 PM Europe/Warsaw, Pads · Coach Marek · Marek Boxing · 75 min, Planned",
    });
    expect(screen.getByRole("header", { name: "Wed, Oct 21, 2026" })).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: /^Roadwork intervals, .*Former coach · Sam R\./ }),
    ).toBeOnTheScreen();
    expect(calls.find((call) => call.path === SESSIONS)?.query.get("view")).toBe("upcoming");
    await user.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith(`/sessions/${ID}`);
  });

  it("tells empty apart from not available and from a failure", async () => {
    backend({ [`GET ${SESSIONS}`]: list([]) });
    const first = await renderWithProviders(<FighterTrainingScreen view="upcoming" filter="all" />);
    expect(await screen.findByText("No upcoming training")).toBeOnTheScreen();
    await first.unmount();

    backend({ [`GET ${SESSIONS}`]: error(404, "not_found") });
    const second = await renderWithProviders(
      <FighterTrainingScreen view="upcoming" filter="all" />,
    );
    expect(await screen.findByText("Training isn’t available")).toBeOnTheScreen();
    expect(screen.queryByText("No upcoming training")).toBeNull();
    await second.unmount();

    let fail = true;
    backend({
      [`GET ${SESSIONS}`]: () => (fail ? error(500, "internal_error") : list([session()])),
    });
    await renderWithProviders(<FighterTrainingScreen view="upcoming" filter="all" />);
    expect(await screen.findByText(/We couldn’t load your training\./)).toBeOnTheScreen();
    expect(screen.queryByText("No upcoming training")).toBeNull();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Pads with coach")).toBeOnTheScreen();
  });

  it("asks the backend for history by status, keeps a past-due one planned, and pages", async () => {
    const completed = session({ status: "completed", completed_at: "2026-10-21T17:20:00Z" });
    const pastDue = session({ id: "5d1c2b3a-2222-4c8a-9d1e-000000000003", title: "S&C circuit" });
    const calls = backend({
      [`GET ${SESSIONS}`]: ({ query }) =>
        query.get("cursor") === "c2" ? list([pastDue]) : list([completed], "c2"),
    });
    await renderWithProviders(<FighterTrainingScreen view="history" filter="completed" />);
    expect(
      await screen.findByRole("button", { name: /Pads with coach.*Completed$/ }),
    ).toBeOnTheScreen();
    const first = calls.find((call) => call.path === SESSIONS);
    expect(first?.query.get("view")).toBe("history");
    expect(first?.query.get("status")).toBe("completed");
    await user.press(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("button", { name: /S&C circuit.*Planned$/ })).toBeOnTheScreen();
    await user.press(screen.getByRole("radio", { name: "Cancelled" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/training?view=history&status=cancelled");
    await user.press(screen.getByRole("tab", { name: "Upcoming" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/training");
  });
});

describe("Session (FT2)", () => {
  it("shows the coach's public identity, the start in its zone and the viewer's, and the notes", async () => {
    jest.mocked(getCalendars).mockReturnValue([{ timeZone: "America/New_York" }] as never);
    backend({ [`GET ${SESSIONS}/${ID}`]: one(session()) });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    expect(await screen.findByRole("header", { name: "Pads with coach" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Coach: Coach Marek · Marek Boxing")).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /^Starts: Wed, Oct 21, 2026, 06:00 PM · Europe\/Warsaw \(UTC\+02:00\)$/,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Your time: Wed, Oct 21, 2026, 12:00 PM · America\/New_York$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Notes from your coach: Jab work.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Mark as completed" })).toBeOnTheScreen();
  });

  it("completes only after confirmation, with one request, and shows the backend's time", async () => {
    let current = session({ starts_at: "2026-10-20T16:00:00Z" });
    const calls = backend({
      [`GET ${SESSIONS}/${ID}`]: () => one(current),
      [`POST ${SESSIONS}/${ID}/complete`]: () => {
        current = { ...current, status: "completed", completed_at: "2026-10-20T17:20:00Z" };
        return one(current);
      },
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Mark as completed" }));
    expect(await screen.findByText(/Coach Marek sees it as completed/)).toBeOnTheScreen();
    expect(posts(calls)).toHaveLength(0);
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(await screen.findByText("Session marked as completed.")).toBeOnTheScreen();
    expect(
      await screen.findByLabelText(/^Completed: Tue, Oct 20, 2026, 07:20 PM$/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
    expect(posts(calls)).toHaveLength(1);
    // No body: the server sets the time.
    expect(posts(calls)[0]?.body).toBeUndefined();
  });

  it("treats a repeat as the same completion, keeping the original time", async () => {
    // The answer to an earlier request was lost; the backend completed it then.
    const done = session({ status: "completed", completed_at: "2026-10-20T17:20:00Z" });
    let reads = 0;
    backend({
      [`GET ${SESSIONS}/${ID}`]: () => (reads++ === 0 ? one(session()) : one(done)),
      [`POST ${SESSIONS}/${ID}/complete`]: one(done),
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Mark as completed" }));
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(
      await screen.findByLabelText(/^Completed: Tue, Oct 20, 2026, 07:20 PM$/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/hasn’t started|was cancelled/)).toBeNull();
  });

  it("keeps a session the backend says has not started planned, and says so", async () => {
    const calls = backend({
      [`GET ${SESSIONS}/${ID}`]: one(session()),
      [`POST ${SESSIONS}/${ID}/complete`]: error(409, "conflict", { starts_at: "not_started" }),
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Mark as completed" }));
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(await screen.findByText(/This session hasn’t started yet\./)).toBeOnTheScreen();
    expect(screen.getByTestId("training-session:planned")).toBeOnTheScreen();
    expect(screen.queryByText("Session marked as completed.")).toBeNull();
    expect(posts(calls)).toHaveLength(1);
  });

  it("reports a session cancelled meanwhile and shows it read-only", async () => {
    let current = session();
    backend({
      [`GET ${SESSIONS}/${ID}`]: () => one(current),
      [`POST ${SESSIONS}/${ID}/complete`]: () => {
        current = {
          ...current,
          status: "cancelled",
          cancelled_by: "coach",
          cancelled_at: "2026-10-20T10:00:00Z",
        };
        return error(409, "conflict", { status: "cancelled" });
      },
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Mark as completed" }));
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(await screen.findByText(/This session was cancelled\./)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId("training-session:cancelled")).toBeOnTheScreen());
    expect(screen.getByLabelText(/^Cancelled: .* · by your coach$/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
  });

  it("without an answer says it may be saved, keeps the session, and a retry shows the stored time", async () => {
    // The backend stores the completion; the answer is lost on the way back.
    let answer: "lost" | "repeat" = "lost";
    const done = session({ status: "completed", completed_at: "2026-10-21T08:22:11Z" });
    const calls = backend({
      [`GET ${SESSIONS}/${ID}`]: one(session()),
      [`POST ${SESSIONS}/${ID}/complete`]: () =>
        answer === "lost" ? Promise.reject(new TypeError("Network request failed")) : one(done),
      [`GET ${SESSIONS}`]: list([]),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Mark as completed" }));
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(await screen.findByText(/It may already be saved/)).toBeOnTheScreen();
    expect(screen.queryByText("Session marked as completed.")).toBeNull();
    expect(screen.getByTestId("training-session:planned")).toBeOnTheScreen();

    // Trying again is safe: the repeat returns the completion stored the first time.
    answer = "repeat";
    await user.press(screen.getByTestId("training:complete:confirm"));
    expect(
      await screen.findByLabelText(/^Completed: Wed, Oct 21, 2026, 10:22 AM$/),
    ).toBeOnTheScreen();
    expect(posts(calls)).toHaveLength(2);
  });

  it("keeps a shown session when reading it again fails, and replaces it only when it is gone", async () => {
    let reply: "ok" | "offline" | "gone" = "ok";
    backend({
      [`GET ${SESSIONS}/${ID}`]: () =>
        reply === "ok"
          ? one(session())
          : reply === "offline"
            ? Promise.reject(new TypeError("Network request failed"))
            : error(404, "not_found"),
    });
    const { queryClient } = await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    expect(await screen.findByRole("header", { name: "Pads with coach" })).toBeOnTheScreen();
    reply = "offline";
    await queryClient.refetchQueries();
    expect(screen.getByRole("header", { name: "Pads with coach" })).toBeOnTheScreen();
    expect(screen.queryByText(/We couldn’t load this session/)).toBeNull();
    reply = "gone";
    await queryClient.refetchQueries();
    expect(await screen.findByText("This session isn’t available")).toBeOnTheScreen();
  });

  it("shows a session completed after the relationship ended with the former coach, read-only", async () => {
    backend({
      [`GET ${SESSIONS}/${ID}`]: one(
        session({
          coach: null,
          coach_display_name_at_end: "Coach Marek",
          status: "completed",
          completed_at: "2026-10-21T17:20:00Z",
        }),
      ),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    expect(await screen.findByLabelText("Coach: Former coach · Coach Marek")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).toBeNull();
  });

  it("offers completion of a started session after the relationship ended", async () => {
    backend({
      [`GET ${SESSIONS}/${ID}`]: one(
        session({ coach: null, coach_display_name_at_end: "Coach Marek" }),
      ),
    });
    await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    expect(await screen.findByText(/This session had already started/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Mark as completed" })).toBeOnTheScreen();
  });

  it("shows unknown and malformed ids as not available, never sending a malformed one", async () => {
    const calls = backend({ [`GET ${SESSIONS}/${ID}`]: error(404, "not_found") });
    const first = await renderWithProviders(<FighterSessionScreen sessionId={ID} />);
    expect(await screen.findByText("This session isn’t available")).toBeOnTheScreen();
    await first.unmount();
    await renderWithProviders(<FighterSessionScreen sessionId="../complete" />);
    expect(await screen.findByText("This session isn’t available")).toBeOnTheScreen();
    expect(calls.some((call) => call.path.includes("complete"))).toBe(false);
  });
});

describe("Training copy", () => {
  it("uses no ICU plural or select: Hermes on iOS has no Intl.PluralRules", () => {
    const flagged = Object.entries(catalogs).filter(([, catalog]) =>
      /\{[^{}]*,\s*(plural|select|selectordinal)\s*,/.test(
        JSON.stringify((catalog as { fighterTraining?: unknown }).fighterTraining ?? {}),
      ),
    );
    expect(flagged.map(([locale]) => locale)).toEqual([]);
  });
});
