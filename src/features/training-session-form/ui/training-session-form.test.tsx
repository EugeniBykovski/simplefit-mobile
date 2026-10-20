import { fireEvent, screen, userEvent, waitFor } from "@testing-library/react-native";
import { getCalendars } from "expo-localization";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { CoachTrainingSession } from "@/entities/training-session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { CreateTrainingSessionForm, EditTrainingSessionForm } from "./training-session-form";

/*
 * CT2 New session and CT4 Edit session (SF-65) against the SF-62 contract,
 * the network mocked at `fetch` and the native pickers driven through their
 * Jest stand-in (src/test/date-time-picker-mock.tsx, iOS: inline in a sheet).
 */

jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const FIGHTERS = "/api/v1/me/coach/fighters";
const SESSIONS = "/api/v1/me/coach/training-sessions";
const REL_ALEX = "0b9f1f7e-1111-4c8a-9d1e-000000000001";
const REL_MAJA = "0b9f1f7e-1111-4c8a-9d1e-000000000002";
const SESSION_ID = "5d1c2b3a-2222-4c8a-9d1e-000000000001";

const fighter = (id: string, name: string | null, username: string | null) => ({
  relationship_id: id,
  status: "active",
  started_at: "2026-09-01T10:00:00Z",
  ended_at: null,
  ended_by: null,
  disclosure_version: "test-disclosure",
  disclosed_fields: ["display_name", "username"],
  fighter: {
    display_name: name,
    username,
    city: null,
    country_code: null,
    experience_level: null,
    stance: null,
    amateur_bout_count: null,
  },
  fighter_display_name_at_end: null,
});
const ALEX = fighter(REL_ALEX, "Alex Kowal", "alex_k");
const MAJA = fighter(REL_MAJA, null, null);

const session = (extra: Partial<CoachTrainingSession> = {}): CoachTrainingSession => ({
  id: SESSION_ID,
  relationship_id: REL_ALEX,
  fighter: { display_name: "Alex Kowal", username: "alex_k" },
  title: "Pads with coach",
  training_type: "pads",
  starts_at: "2026-10-21T16:00:00Z",
  time_zone: "Europe/Warsaw",
  duration_minutes: 75,
  notes: null,
  status: "planned",
  completed_at: null,
  cancelled_at: null,
  cancelled_by: null,
  cancel_reason: null,
  inserted_at: "2026-10-20T09:00:00Z",
  updated_at: "2026-10-20T09:00:00Z",
  ...extra,
});

type Call = { method: string; path: string; body: Record<string, unknown> | undefined };
type Reply = Response | ((call: Call) => Response | Promise<Response>);

function backend(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const parsed = new URL(url);
      const call = {
        method: (init.method ?? "GET").toUpperCase(),
        path: parsed.pathname,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      if (call.path === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      const reply = routes[`${call.method} ${call.path}`];
      if (reply === undefined) throw new Error(`unexpected ${call.method} ${call.path}`);
      const response = typeof reply === "function" ? reply(call) : reply.clone();
      return Promise.resolve(response);
    }),
  );
  return calls;
}
const roster = (items: unknown[]) => jsonResponse({ relationships: items, next_cursor: null });
const error = (status: number, code: string, details: Record<string, unknown> = {}) =>
  jsonResponse({ error: { code, message: "x", details, request_id: "r" } }, { status });
const writes = (calls: Call[]) => calls.filter((call) => call.method !== "GET");
/** No answer at all: offline, or the response was lost. */
const lost = () => Promise.reject(new TypeError("Network request failed"));

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

/** Picks a wall date or time in the native picker (it runs in UTC) and confirms. */
async function pick(row: RegExp, value: string) {
  await user.press(screen.getByRole("button", { name: row }));
  const picker = await screen.findByTestId("native-date-time-picker");
  expect(picker.props.timeZoneName).toBe("UTC");
  fireEvent(picker, "valueChange", { nativeEvent: {} }, new Date(value));
  await user.press(screen.getByRole("button", { name: "Done" }));
}

async function fillCreate({ date = "2026-11-02", time = "19:00" } = {}) {
  await user.type(screen.getByLabelText("Title"), "Pads with coach");
  await user.press(screen.getByRole("radio", { name: "Pads" }));
  await pick(/^Date,/, `${date}T12:00:00Z`);
  await pick(/^Start time,/, `2000-01-01T${time}:00Z`);
}

const submit = () => user.press(screen.getByRole("button", { name: "Assign session" }));

describe("New session (CT2)", () => {
  it("creates one session for the only fighter with the zone's offset on that day and a request key", async () => {
    const onSaved = jest.fn();
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX]),
      [`POST ${SESSIONS}`]: ({ body }) =>
        jsonResponse({ training_session: session({ ...body, id: SESSION_ID }) }, { status: 201 }),
    });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={onSaved} onFighters={jest.fn()} />,
    );
    expect(
      await screen.findByRole("button", { name: "Fighter, Alex Kowal · @alex_k" }),
    ).toBeOnTheScreen();
    // The device's zone is the default, and named as this device's.
    expect(screen.getByRole("button", { name: "Time zone, Europe/Warsaw" })).toBeOnTheScreen();
    await fillCreate();
    await submit();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [create] = writes(calls);
    expect(create?.body).toEqual({
      relationship_id: REL_ALEX,
      title: "Pads with coach",
      training_type: "pads",
      // 2 November: Warsaw is back on winter time (UTC+01:00), not today's offset.
      starts_at: "2026-11-02T19:00:00+01:00",
      time_zone: "Europe/Warsaw",
      duration_minutes: 60,
      client_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION_ID }), "created");
  });

  it("asks for every missing field and sends nothing", async () => {
    const calls = backend({ [`GET ${FIGHTERS}`]: roster([ALEX, MAJA]) });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await user.press(await screen.findByRole("button", { name: "Assign session" }));
    for (const message of [
      "Choose a fighter.",
      "Enter a title of up to 80 characters.",
      "Choose a training type.",
      "Choose a date.",
      "Choose a start time.",
    ])
      expect(await screen.findByText(message)).toBeOnTheScreen();
    await user.clear(screen.getByLabelText("Duration"));
    await user.type(screen.getByLabelText("Duration"), "4");
    await submit();
    expect(
      await screen.findByText("Enter a whole number of minutes from 5 to 600."),
    ).toBeOnTheScreen();
    expect(writes(calls)).toEqual([]);
  });

  it("chooses among several fighters, naming one who shares no name by the date", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX, MAJA]),
      [`POST ${SESSIONS}`]: ({ body }) =>
        jsonResponse({ training_session: session({ ...body }) }, { status: 201 }),
    });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await user.press(await screen.findByRole("button", { name: "Fighter, Choose a fighter" }));
    await user.press(
      await screen.findByRole("radio", { name: /^Fighter \(name not shared\), Since/ }),
    );
    expect(
      screen.getByRole("button", { name: "Fighter, Fighter (name not shared)" }),
    ).toBeOnTheScreen();
    await fillCreate();
    await submit();
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]?.body).toMatchObject({ relationship_id: REL_MAJA });
  });

  it("never sends a time the clocks skip (Warsaw spring forward)", async () => {
    const calls = backend({ [`GET ${FIGHTERS}`]: roster([ALEX]) });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate({ date: "2027-03-28", time: "02:30" });
    expect(await screen.findByText(/This time doesn’t exist on that day\./)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Assign session" })).toBeDisabled();
    expect(writes(calls)).toEqual([]);
  });

  it("asks which of a repeated time (Warsaw fall back) and sends exactly that offset", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX]),
      [`POST ${SESSIONS}`]: ({ body }) =>
        jsonResponse({ training_session: session({ ...body }) }, { status: 201 }),
    });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate({ date: "2026-10-25", time: "02:30" });
    expect(await screen.findByText("This time happens twice on that day.")).toBeOnTheScreen();
    await submit();
    expect(await screen.findByText("Choose which of the two times you mean.")).toBeOnTheScreen();
    expect(writes(calls)).toEqual([]);

    await user.press(screen.getByRole("radio", { name: "Second · UTC+01:00" }));
    await submit();
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]?.body).toMatchObject({ starts_at: "2026-10-25T02:30:00+01:00" });
  });

  it("resolves the same wall time again when the zone changes after it was entered", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX]),
      [`POST ${SESSIONS}`]: ({ body }) =>
        jsonResponse({ training_session: session({ ...body }) }, { status: 201 }),
    });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate();
    await user.press(screen.getByRole("button", { name: "Time zone, Europe/Warsaw" }));
    await user.type(await screen.findByLabelText("Search time zones"), "new york");
    await user.press(await screen.findByRole("radio", { name: /^America\/New_York, UTC-05:00$/ }));
    await submit();
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]?.body).toMatchObject({
      starts_at: "2026-11-02T19:00:00-05:00",
      time_zone: "America/New_York",
    });
  });

  it("retries a lost answer with the same key and a changed body with a new one", async () => {
    let answer: "lost" | "ok" = "lost";
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX]),
      [`GET ${SESSIONS}`]: jsonResponse({ training_sessions: [], next_cursor: null }),
      [`POST ${SESSIONS}`]: ({ body }) =>
        answer === "lost"
          ? (lost() as never)
          : jsonResponse({ training_session: session({ ...body }) }, { status: 201 }),
    });
    const onSaved = jest.fn();
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={onSaved} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate();
    await submit();
    expect(await screen.findByText(/We couldn’t save the session\./)).toBeOnTheScreen();
    await submit();
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    const [first, second] = writes(calls);
    expect(second?.body?.client_request_id).toBe(first?.body?.client_request_id);

    answer = "ok";
    await submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), "created"));
    expect(writes(calls)[2]?.body?.client_request_id).toBe(first?.body?.client_request_id);
  });

  it("after a lost answer keeps the key when the coach edits, and shows the session stored earlier", async () => {
    // The backend stored the first attempt; the answer never arrived.
    let stored: CoachTrainingSession | null = null;
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX]),
      [`GET ${SESSIONS}`]: jsonResponse({ training_sessions: [], next_cursor: null }),
      [`POST ${SESSIONS}`]: ({ body }) => {
        if (stored === null) {
          stored = session({ ...body, id: SESSION_ID } as Partial<CoachTrainingSession>);
          return lost() as never;
        }
        // The same key: the session stored the first time, unchanged (200).
        return jsonResponse({ training_session: stored });
      },
    });
    const onSaved = jest.fn();
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={onSaved} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate();
    await submit();
    expect(await screen.findByText(/We couldn’t save the session\./)).toBeOnTheScreen();

    // The coach changes one field and tries again.
    await user.clear(screen.getByLabelText("Duration"));
    await user.type(screen.getByLabelText("Duration"), "90");
    await submit();

    expect(await screen.findByText(/An earlier attempt was already saved\./)).toBeOnTheScreen();
    const [first, second] = writes(calls);
    expect(second?.body?.duration_minutes).toBe(90);
    expect(second?.body?.client_request_id).toBe(first?.body?.client_request_id);
    // Nothing is reported as created with the new values.
    expect(onSaved).not.toHaveBeenCalled();
    await user.press(screen.getByRole("button", { name: "Open the saved session" }));
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: SESSION_ID, duration_minutes: 60 }),
      "earlier",
    );
  });

  it("says when an earlier attempt already planned for another fighter (409 reused)", async () => {
    let reply: "lost" | "reused" | "ok" = "lost";
    const calls = backend({
      [`GET ${FIGHTERS}`]: roster([ALEX, MAJA]),
      [`GET ${SESSIONS}`]: jsonResponse({ training_sessions: [], next_cursor: null }),
      [`POST ${SESSIONS}`]: ({ body }) =>
        reply === "lost"
          ? (lost() as never)
          : reply === "reused"
            ? error(409, "conflict", { client_request_id: "reused" })
            : jsonResponse({ training_session: session({ ...body }) }, { status: 201 }),
    });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await user.press(await screen.findByRole("button", { name: "Fighter, Choose a fighter" }));
    await user.press(await screen.findByRole("radio", { name: /^Alex Kowal/ }));
    await fillCreate();
    await submit();
    expect(await screen.findByText(/We couldn’t save the session\./)).toBeOnTheScreen();

    reply = "reused";
    await user.press(screen.getByRole("button", { name: /^Fighter, Alex/ }));
    await user.press(await screen.findByRole("radio", { name: /^Fighter \(name not shared\)/ }));
    await submit();
    expect(
      await screen.findByText(/planned a session for another fighter\. Nothing new was created/),
    ).toBeOnTheScreen();

    // The backend answered for that key: a deliberate new attempt gets a new one.
    reply = "ok";
    await submit();
    await waitFor(() => expect(writes(calls)).toHaveLength(3));
    const [first, second, third] = writes(calls);
    expect(second?.body?.client_request_id).toBe(first?.body?.client_request_id);
    expect(third?.body?.client_request_id).not.toBe(first?.body?.client_request_id);
  });

  it("maps the backend's refusals to their fields and to notices", async () => {
    let reply = error(422, "validation_error", {
      fields: { starts_at: ["must be between one day ago and one year from now"] },
      field_codes: { starts_at: ["out_of_range"] },
    });
    backend({ [`GET ${FIGHTERS}`]: roster([ALEX]), [`POST ${SESSIONS}`]: () => reply.clone() });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    await screen.findByRole("button", { name: /^Fighter, Alex/ });
    await fillCreate();
    await submit();
    expect(
      await screen.findByText("Choose a start between yesterday and one year from now."),
    ).toBeOnTheScreen();
    // The backend's English message is never shown.
    expect(screen.queryByText(/must be between one day ago/)).toBeNull();

    reply = error(404, "not_found");
    await submit();
    expect(await screen.findByText(/You can’t plan for this fighter any more\./)).toBeOnTheScreen();
  });

  it("tells no fighters apart from planning not available and from a failure", async () => {
    backend({ [`GET ${FIGHTERS}`]: roster([]) });
    const onFighters = jest.fn();
    const first = await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={onFighters} />,
    );
    expect(await screen.findByText("No fighters to plan for yet")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Go to Fighters" }));
    expect(onFighters).toHaveBeenCalled();
    await first.unmount();

    backend({ [`GET ${FIGHTERS}`]: error(404, "not_found") });
    const second = await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    expect(await screen.findByText(/You can’t plan for this fighter any more\./)).toBeOnTheScreen();
    expect(screen.queryByText("No fighters to plan for yet")).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign session" })).toBeNull();
    await second.unmount();

    backend({ [`GET ${FIGHTERS}`]: error(500, "internal_error") });
    await renderWithProviders(
      <CreateTrainingSessionForm onSaved={jest.fn()} onFighters={jest.fn()} />,
    );
    expect(await screen.findByText(/We couldn’t load your sessions\./)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
  });
});

describe("Edit session (CT4)", () => {
  it("shows the session's wall time in its own zone and sends only the changed fields", async () => {
    const onSaved = jest.fn();
    const calls = backend({
      [`PATCH ${SESSIONS}/${SESSION_ID}`]: ({ body }) =>
        jsonResponse({
          training_session: session({ ...body, updated_at: "2026-10-20T10:00:00Z" }),
        }),
    });
    await renderWithProviders(<EditTrainingSessionForm session={session()} onSaved={onSaved} />);
    expect(
      await screen.findByRole("button", { name: "Fighter, Alex Kowal · @alex_k" }),
    ).toBeDisabled();
    // 16:00 UTC is 18:00 in Warsaw on 21 October (English shows 12-hour times).
    expect(screen.getByRole("button", { name: /^Start time, 06:00 PM/ })).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: "Save changes" }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: SESSION_ID }), "unchanged");
    expect(writes(calls)).toEqual([]);

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Pads, light");
    await pick(/^Start time,/, "2000-01-01T19:30:00Z");
    await user.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]?.body).toEqual({
      title: "Pads, light",
      starts_at: "2026-10-21T19:30:00+02:00",
    });
    expect(onSaved).toHaveBeenLastCalledWith(expect.anything(), "updated");
  });

  it("reports a session completed or cancelled meanwhile (409) and offers no form for a terminal one", async () => {
    backend({
      [`PATCH ${SESSIONS}/${SESSION_ID}`]: error(409, "conflict", { status: "completed" }),
    });
    const onSaved = jest.fn();
    const first = await renderWithProviders(
      <EditTrainingSessionForm session={session()} onSaved={onSaved} />,
    );
    await user.clear(await screen.findByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Changed");
    await user.press(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/This session can’t be changed any more\./)).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    await first.unmount();

    await renderWithProviders(
      <EditTrainingSessionForm
        session={session({ status: "completed", completed_at: "2026-10-21T18:00:00Z" })}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByText(/This session can’t be changed any more\./)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
