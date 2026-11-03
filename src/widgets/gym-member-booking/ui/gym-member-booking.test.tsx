import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type {
  GymMemberClass,
  MyGymClassBooking,
  MyGymMembership,
} from "@/shared/api/generated/model";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { MemberClassesScreen } from "./member-classes-screen";
import { MemberGymsScreen } from "./member-gyms-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

/*
 * The member side on mobile (SF-100: F13 and F16's rows at account level)
 * against the SF-99 contract: the membership decides what is shown, places
 * left and bookings are the backend's, success is said only from its
 * answer, a lost answer is retried with the same request key, cancelling is
 * confirmed in the sheet, and nothing about credits or a waitlist exists.
 */

const GYM = "3d0a7f52-1c8e-4b6a-9f20-5e7d1b3c9a64";
const MEMBER = "8b1b2c3d-0000-4000-8000-000000000001";
const CLASS = "7a1b2c3d-0000-4000-8000-000000000501";
const BOOKING = "9c1b2c3d-0000-4000-8000-000000000901";
const NOW = new Date("2026-11-04T10:00:00Z");

const MEMBERSHIPS = "GET /api/v1/me/gym-memberships";
const CLASSES = `GET /api/v1/me/gym-memberships/${MEMBER}/classes`;
const BOOK = `POST /api/v1/me/gym-memberships/${MEMBER}/class-bookings`;
const MY_BOOKINGS = "GET /api/v1/me/class-bookings";
const CANCEL = `POST /api/v1/me/class-bookings/${BOOKING}/cancel`;

const membership = (overrides: Partial<MyGymMembership> = {}): MyGymMembership => ({
  gym: { gym_id: GYM, name: "Ring One Boxing" },
  gym_member_id: MEMBER,
  status: "active",
  joined_via: "join_code",
  auto_approved: false,
  requested_at: "2026-10-30T10:00:00Z",
  joined_at: "2026-10-30T11:00:00Z",
  responded_at: "2026-10-30T11:00:00Z",
  ended_at: null,
  ended_reason: null,
  ...overrides,
});

const klass = (overrides: Partial<GymMemberClass> = {}): GymMemberClass => ({
  occurrence_id: CLASS,
  title: "Technical boxing",
  status: "scheduled",
  starts_at: "2026-11-04T17:00:00Z",
  ends_at: "2026-11-04T18:30:00Z",
  time_zone: "Europe/Warsaw",
  local_starts_at: "2026-11-04T18:00:00",
  local_ends_at: "2026-11-04T19:30:00",
  utc_offset_minutes: 60,
  duration_minutes: 90,
  venue: { name: "Ring 2" },
  instructor: { name: "Tomasz Z." },
  capacity: 16,
  remaining_capacity: 9,
  booking: null,
  ...overrides,
});

const booking = (overrides: Partial<MyGymClassBooking> = {}): MyGymClassBooking => ({
  booking_id: BOOKING,
  gym_member_id: MEMBER,
  status: "confirmed",
  booked_via: "member",
  confirmed_at: "2026-11-04T10:00:00Z",
  cancelled_at: null,
  cancel_reason: null,
  checked_in_at: null,
  class: {
    occurrence_id: CLASS,
    gym: { gym_id: GYM, name: "Ring One Boxing" },
    title: "Technical boxing",
    status: "scheduled",
    starts_at: "2026-11-04T17:00:00Z",
    ends_at: "2026-11-04T18:30:00Z",
    time_zone: "Europe/Warsaw",
    local_starts_at: "2026-11-04T18:00:00",
    local_ends_at: "2026-11-04T19:30:00",
    utc_offset_minutes: 60,
    venue: { name: "Ring 2" },
    instructor: { name: "Tomasz Z." },
  },
  ...overrides,
});

type Answer = { status: number; body?: unknown } | Error;
const ok = (body: unknown, status = 200): Answer => ({ status, body });
const err = (status: number, code: string, details: Record<string, unknown> = {}): Answer => ({
  status,
  body: { error: { code, message: "x", details } },
});
type Call = { key: string; body: unknown };
function api(routes: Record<string, Answer[]>) {
  const calls: Call[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
      calls.push({ key, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined });
      const queue = routes[key];
      if (!queue) return Promise.resolve(jsonResponse({}, { status: 404 }));
      const answer = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(jsonResponse(answer.body ?? {}, { status: answer.status }));
    }),
  );
  return calls;
}
const memberships = (items: MyGymMembership[]) => ok({ memberships: items, next_cursor: null });
const classes = (items: GymMemberClass[]) => ok({ classes: items, next_cursor: null });
const posts = (calls: Call[], key: string) => calls.filter((call) => call.key === key);

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

describe("F13 · book a class at account level (SF-100)", () => {
  it("lists today's classes with the backend's places left and books from the sheet", async () => {
    const calls = api({
      [MEMBERSHIPS]: [memberships([membership()])],
      [CLASSES]: [
        classes([klass()]),
        classes([
          klass({
            remaining_capacity: 8,
            booking: { booking_id: BOOKING, status: "confirmed", checked_in_at: null },
          }),
        ]),
      ],
      [BOOK]: [ok({ booking: booking() }, 201)],
      [MY_BOOKINGS]: [ok({ bookings: [], next_cursor: null })],
    });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    const row = await screen.findByTestId(`member-class-${CLASS}`);
    expect(within(row).getByText("Tomasz Z. · Ring 2 · 9 of 16 left")).toBeOnTheScreen();
    fireEvent.press(row);
    fireEvent.press(await screen.findByTestId("confirm-booking"));
    expect(await screen.findByText("Booking confirmed. Your place is saved.")).toBeOnTheScreen();
    const [sent] = posts(calls, BOOK);
    expect(sent!.body).toEqual({
      occurrence_id: CLASS,
      client_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(await screen.findByRole("button", { name: "Cancel booking" })).toBeOnTheScreen();
    expect(screen.queryByText(/credit|waitlist/i)).toBeNull();
  });

  it("says a full class lost to someone else and offers no waitlist", async () => {
    api({
      [MEMBERSHIPS]: [memberships([membership()])],
      [CLASSES]: [
        classes([klass({ remaining_capacity: 1 })]),
        classes([klass({ remaining_capacity: 0 })]),
      ],
      [BOOK]: [err(409, "conflict", { class_occurrence: "full", capacity: 16 })],
      [MY_BOOKINGS]: [ok({ bookings: [], next_cursor: null })],
    });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    fireEvent.press(await screen.findByTestId(`member-class-${CLASS}`));
    fireEvent.press(await screen.findByTestId("confirm-booking"));
    expect(
      await screen.findByText(
        "This class is full (capacity: 16). No booking was made, and there is no waitlist.",
      ),
    ).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("confirm-booking")).toBeNull());
  });

  it("retries a lost answer with the same request key", async () => {
    const calls = api({
      [MEMBERSHIPS]: [memberships([membership()])],
      [CLASSES]: [classes([klass()])],
      [BOOK]: [new TypeError("Network request failed"), ok({ booking: booking() }, 200)],
      [MY_BOOKINGS]: [ok({ bookings: [], next_cursor: null })],
    });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    fireEvent.press(await screen.findByTestId(`member-class-${CLASS}`));
    fireEvent.press(await screen.findByTestId("confirm-booking"));
    expect(await screen.findByText(/We couldn’t confirm the outcome/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(posts(calls, BOOK)).toHaveLength(2));
    const [first, second] = posts(calls, BOOK) as { body: { client_request_id: string } }[];
    expect(second!.body.client_request_id).toBe(first!.body.client_request_id);
  });

  it("cancels the member's booking only after a confirmation in the sheet", async () => {
    const calls = api({
      [MEMBERSHIPS]: [memberships([membership()])],
      [CLASSES]: [
        classes([
          klass({ booking: { booking_id: BOOKING, status: "confirmed", checked_in_at: null } }),
        ]),
        classes([
          klass({ booking: { booking_id: BOOKING, status: "cancelled", checked_in_at: null } }),
        ]),
      ],
      [CANCEL]: [
        ok({
          booking: booking({
            status: "cancelled",
            cancel_reason: "member_cancelled",
            cancelled_at: "2026-11-04T10:00:00Z",
          }),
        }),
      ],
      [MY_BOOKINGS]: [ok({ bookings: [], next_cursor: null })],
    });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    fireEvent.press(await screen.findByTestId(`member-class-${CLASS}`));
    fireEvent.press(await screen.findByRole("button", { name: "Cancel booking" }));
    expect(await screen.findByRole("header", { name: "Cancel your booking?" })).toBeOnTheScreen();
    expect(posts(calls, CANCEL)).toHaveLength(0);
    expect(screen.queryByText(/refund/i)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Cancel booking" }));
    await waitFor(() => expect(posts(calls, CANCEL)).toHaveLength(1));
    expect(await screen.findByTestId("confirm-booking")).toBeOnTheScreen();
  });

  it.each([
    ["requested", "Your request is waiting"],
    ["ended", "Your membership isn’t active"],
  ] as const)("says a %s membership as such and reads no class", async (status, title) => {
    const calls = api({ [MEMBERSHIPS]: [memberships([membership({ status })])] });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    expect(await screen.findByRole("header", { name: title })).toBeOnTheScreen();
    expect(calls.some((call) => call.key === CLASSES)).toBe(false);
  });

  it("says when the viewer is not a member of the gym in the route", async () => {
    api({ [MEMBERSHIPS]: [memberships([])] });
    await renderWithProviders(<MemberClassesScreen gymId={GYM} />);
    expect(
      await screen.findByRole("header", { name: "You’re not a member of this gym" }),
    ).toBeOnTheScreen();
  });
});

describe("My gyms · F16's rows (SF-100)", () => {
  it("opens an active membership's classes and shows a pending request as waiting", async () => {
    api({
      [MEMBERSHIPS]: [
        memberships([
          membership(),
          membership({
            gym_member_id: "8b1b2c3d-0000-4000-8000-000000000002",
            status: "requested",
            gym: { gym_id: "3d0a7f52-1c8e-4b6a-9f20-5e7d1b3c9a65", name: "Kraków Boxing" },
          }),
        ]),
      ],
    });
    await renderWithProviders(<MemberGymsScreen />);
    fireEvent.press(
      await screen.findByRole("button", { name: "Open the classes of Ring One Boxing" }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(`/me/gyms/${GYM}/classes`);
    expect(screen.getByText("Kraków Boxing")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Kraków Boxing/ })).toBeNull();
  });
});
