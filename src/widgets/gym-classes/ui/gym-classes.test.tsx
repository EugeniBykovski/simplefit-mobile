import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import type { Gym } from "@/entities/gym";
import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { GymClassOccurrence, GymClassRosterEntry } from "@/shared/api/generated/model";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { ClassRosterView } from "./class-roster-screen";
import { GymClassesView } from "./gym-classes-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

/*
 * G08 Classes and G03 Class roster on mobile (SF-100): every class is a row
 * of the SF-97 timetable, a roster opens only for a role that may read it
 * (a coach: their own classes), counts and short names are the backend's,
 * and check-in is recorded by the backend once per booking.
 */

const GYM = "8d2e4f60-1a2b-4c3d-8e9f-a0b1c2d3e4f5";
const OWN = "7a1b2c3d-0000-4000-8000-000000000002";
const OTHER = "7a1b2c3d-0000-4000-8000-000000000009";
const CLASS = "7a1b2c3d-0000-4000-8000-000000000501";
const CLASS_B = "7a1b2c3d-0000-4000-8000-000000000502";
const BOOKING = "9c1b2c3d-0000-4000-8000-000000000901";
const NOW = new Date("2026-11-04T10:00:00Z");

const gym = (role: Gym["viewer"]["role"], permissions: string[]): Gym => ({
  id: GYM,
  name: "Ring A Boxing",
  gym_type: "boxing_club",
  setup_status: "completed",
  inserted_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
  locations: [],
  viewer: {
    role,
    permissions: permissions as Gym["viewer"]["permissions"],
    staff_membership_id: OWN,
  },
});

const occurrence = (overrides: Partial<GymClassOccurrence> = {}): GymClassOccurrence =>
  ({
    occurrence_id: CLASS,
    gym_id: GYM,
    template_id: null,
    series_id: null,
    series_local_date: null,
    title: "Technical boxing",
    starts_at: "2026-11-04T17:00:00Z",
    ends_at: "2026-11-04T18:15:00Z",
    local_starts_at: "2026-11-04T18:00:00",
    local_ends_at: "2026-11-04T19:15:00",
    time_zone: "Europe/Warsaw",
    utc_offset_minutes: 60,
    duration_minutes: 75,
    capacity: 14,
    venue: { venue_id: "v1", name: "Ring 2" },
    instructor: { staff_membership_id: OWN, name: "Tomasz Z." },
    needs_instructor: false,
    rescheduled: false,
    status: "scheduled",
    cancel_reason: null,
    cancelled_at: null,
    revision: 1,
    created_at: "2026-10-27T10:00:00Z",
    updated_at: "2026-10-27T10:00:00Z",
    ...overrides,
  }) as GymClassOccurrence;

const entry = (overrides: Partial<GymClassRosterEntry> = {}): GymClassRosterEntry => ({
  booking_id: BOOKING,
  gym_member_id: "8b1b2c3d-0000-4000-8000-000000000001",
  name: "Marta K.",
  status: "confirmed",
  booked_via: "member",
  confirmed_at: "2026-11-03T09:00:00Z",
  cancelled_at: null,
  cancel_reason: null,
  checked_in_at: null,
  ...overrides,
});

type Answer = { status: number; body?: unknown };
const ok = (body: unknown, status = 200): Answer => ({ status, body });
const err = (status: number, code: string, details: Record<string, unknown> = {}): Answer => ({
  status,
  body: { error: { code, message: "x", details } },
});
function api(routes: Record<string, Answer[]>) {
  const calls: string[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
      calls.push(key);
      const queue = routes[key];
      if (!queue) return Promise.resolve(jsonResponse({}, { status: 404 }));
      const answer = queue.length > 1 ? queue.shift()! : queue[0]!;
      return Promise.resolve(jsonResponse(answer.body ?? {}, { status: answer.status }));
    }),
  );
  return calls;
}

const LIST = `GET /api/v1/gyms/${GYM}/class-occurrences`;
const ONE = `GET /api/v1/gyms/${GYM}/class-occurrences/${CLASS}`;
const ROSTER = `GET /api/v1/gyms/${GYM}/class-occurrences/${CLASS}/bookings`;
const CHECK_IN = `POST /api/v1/gyms/${GYM}/class-bookings/${BOOKING}/check-in`;
const roster = (entries: GymClassRosterEntry[], checkedIn = 0) =>
  ok({
    summary: {
      capacity: 14,
      confirmed_count: entries.length,
      remaining_capacity: 14 - entries.length,
      checked_in_count: checkedIn,
    },
    bookings: entries,
    next_cursor: null,
  });
const STAFF = ["view_workspace", "view_rosters", "record_check_in"];

beforeEach(async () => {
  // Only the clock is fixed: the providers' own timers keep running.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
  mockRouter.push.mockClear();
  resetSessionForTests();
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({}))));
  await completeAuthentication({
    access_token: "test-access",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "test-refresh",
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe("G08 · Classes (SF-100)", () => {
  it("lists the backend's classes and opens the roster of a class the coach teaches only", async () => {
    api({
      [LIST]: [
        ok({
          occurrences: [
            occurrence(),
            occurrence({
              occurrence_id: CLASS_B,
              title: "Sparring",
              instructor: { staff_membership_id: OTHER, name: "Kuba" },
              local_starts_at: "2026-11-04T20:00:00",
              local_ends_at: "2026-11-04T21:30:00",
            }),
          ],
          next_cursor: null,
        }),
      ],
    });
    await renderWithProviders(
      <GymClassesView gym={gym("coach", ["view_workspace", "view_rosters", "record_check_in"])} />,
    );
    const own = await screen.findByRole("button", {
      name: "Technical boxing at 18:00, open the roster",
    });
    expect(
      within(screen.getByTestId(`gym-class-${CLASS}`)).getByText("Tomasz Z. · Ring 2 · 75 min"),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId(`gym-class-${CLASS}`)).getByText("Up to 14"),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Sparring/ })).toBeNull();
    fireEvent.press(own);
    expect(mockRouter.push).toHaveBeenCalledWith(`/gyms/${GYM}/classes/${CLASS}/roster`);
    expect(screen.queryByText(/\d+\/\d+|waitlist/i)).toBeNull();
  });
});

describe("G03 · Class roster (SF-100)", () => {
  it("shows the backend's counts and short names and records a check-in once", async () => {
    const calls = api({
      [ONE]: [ok({ occurrence: occurrence() })],
      [ROSTER]: [roster([entry()]), roster([entry({ checked_in_at: "2026-11-04T10:00:00Z" })], 1)],
      [CHECK_IN]: [
        ok(
          {
            check_in: {
              check_in_id: "c1",
              booking_id: BOOKING,
              occurrence_id: CLASS,
              gym_member_id: entry().gym_member_id,
              method: "manual",
              checked_in_at: "2026-11-04T10:00:00Z",
            },
          },
          201,
        ),
      ],
    });
    await renderWithProviders(<ClassRosterView gym={gym("front_desk", STAFF)} classId={CLASS} />);
    expect(await screen.findByText("Marta K.")).toBeOnTheScreen();
    expect(screen.getByText("1/14")).toBeOnTheScreen();
    expect(screen.getByText("Places left: 13")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(`check-in-${BOOKING}`));
    expect(await screen.findByText("Marta K. is checked in.")).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText("Checked in: 1")).toBeOnTheScreen());
    expect(screen.queryByTestId(`check-in-${BOOKING}`)).toBeNull();
    expect(calls.filter((call) => call === CHECK_IN)).toHaveLength(1);
    expect(screen.queryByText(/@|waitlist|promote|pay at desk|trial/i)).toBeNull();
  });

  it("says a check-in outside the class's day was refused", async () => {
    api({
      [ONE]: [ok({ occurrence: occurrence() })],
      [ROSTER]: [roster([entry()])],
      [CHECK_IN]: [err(409, "conflict", { class_occurrence: "not_today" })],
    });
    await renderWithProviders(<ClassRosterView gym={gym("owner", STAFF)} classId={CLASS} />);
    fireEvent.press(await screen.findByTestId(`check-in-${BOOKING}`));
    expect(
      await screen.findByText(
        "Check-in is recorded on the day of the class. Nothing was recorded.",
      ),
    ).toBeOnTheScreen();
  });

  it("says a refused roster as such", async () => {
    api({ [ONE]: [ok({ occurrence: occurrence() })], [ROSTER]: [err(403, "forbidden")] });
    await renderWithProviders(<ClassRosterView gym={gym("coach", STAFF)} classId={CLASS} />);
    expect(await screen.findByText("Your role can’t do this. Nothing changed.")).toBeOnTheScreen();
  });
});
