import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { MyGymInvitation, MyGymMembership } from "@/shared/api/generated/model";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { MemberGymsScreen } from "./member-gyms-screen";
import { MemberInvitationsScreen } from "./member-invitations-screen";
import { MemberJoinScreen } from "./member-join-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

/*
 * Joining by code, the invitation inbox and My gyms' actions (SF-135) against the
 * SF-95 contract: the code travels only in bodies, opening accepts nothing, each
 * press sends once, an unconfirmed outcome reads the backend again, and every
 * status is the backend's answer.
 */

const GYM = "3d0a7f52-1c8e-4b6a-9f20-5e7d1b3c9a64";
const MEMBER = "8b1b2c3d-0000-4000-8000-000000000001";
const INVITE = "7a1b2c3d-0000-4000-8000-000000000701";
const CODE = "ABCD-EFGH";

const PREVIEW = "POST /api/v1/gym-join/preview";
const JOIN = "POST /api/v1/me/gym-memberships/join";
const MEMBERSHIPS = "GET /api/v1/me/gym-memberships";
const INBOX = "GET /api/v1/me/gym-invitations";
const ACCEPT = `POST /api/v1/me/gym-invitations/${INVITE}/accept`;
const DECLINE = `POST /api/v1/me/gym-invitations/${INVITE}/decline`;

const membership = (overrides: Partial<MyGymMembership> = {}): MyGymMembership => ({
  gym: { gym_id: GYM, name: "Ring One Boxing" },
  gym_member_id: MEMBER,
  status: "requested",
  joined_via: "join_code",
  auto_approved: false,
  requested_at: "2026-10-30T10:00:00Z",
  joined_at: null,
  responded_at: null,
  ended_at: null,
  ended_reason: null,
  ...overrides,
});
const invitation = (overrides: Partial<MyGymInvitation> = {}): MyGymInvitation =>
  ({
    invitation_id: INVITE,
    status: "pending",
    gym: { gym_id: GYM, name: "Ring One Boxing" },
    invited_by: { first_name: "Yauheni", role: "owner" },
    sent_to: "marta@example.com",
    created_at: "2026-11-13T10:00:00Z",
    expires_at: "2026-11-20T10:00:00Z",
    responded_at: null,
    gym_member_id: null,
    ...overrides,
  }) as MyGymInvitation;

type Answer = { status: number; body?: unknown; headers?: Record<string, string> } | Error;
const error = (status: number, code: string, details: Record<string, unknown> = {}) => ({
  status,
  body: { error: { code, message: code, details, request_id: null } },
});
const preview = (requires_approval = true) => ({
  status: 200,
  body: { preview: { gym: { name: "Ring One Boxing" }, requires_approval } },
});
const rows = (memberships: MyGymMembership[]) => ({
  status: 200,
  body: { memberships, next_cursor: null },
});
const inbox = (invitations: MyGymInvitation[], next_cursor: string | null = null) => ({
  status: 200,
  body: { invitations, next_cursor },
});

function api(routes: Record<string, Answer[]>) {
  const calls: { key: string; url: string; body: unknown }[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      const key = `${(init.method ?? "GET").toUpperCase()} ${pathname}`;
      calls.push({
        key,
        url,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const queue = routes[key];
      if (!queue) return Promise.resolve(jsonResponse({}, { status: 500 }));
      const answer = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(
        jsonResponse(answer.body ?? {}, {
          status: answer.status,
          ...(answer.headers ? { headers: answer.headers } : {}),
        }),
      );
    }),
  );
  return calls;
}

const lookUp = async (code = CODE) => {
  await fireEvent.changeText(await screen.findByTestId("member-join-code"), code);
  await fireEvent.press(screen.getByTestId("member-join-find"));
};
const submit = async () => {
  await fireEvent.press(await screen.findByTestId("member-join-submit"));
};

beforeEach(async () => {
  jest.clearAllMocks();
  resetSessionForTests();
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: { id: "u1" } }))));
  await completeAuthentication({
    access_token: "test-access",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "test-refresh",
  });
});

describe("MemberJoinScreen (SF-135)", () => {
  it("shows capitals and the hyphen, and an empty code sends nothing", async () => {
    const calls = api({});
    await renderWithProviders(<MemberJoinScreen />);
    await fireEvent.press(await screen.findByTestId("member-join-find"));
    expect(await screen.findByText("Enter your gym's code.")).toBeOnTheScreen();
    expect(calls).toEqual([]);
    await fireEvent.changeText(screen.getByTestId("member-join-code"), "abcdefgh");
    await waitFor(() => expect(screen.getByTestId("member-join-code").props.value).toBe(CODE));
  });

  it("previewing creates nothing; joining is a separate press, with the code in the body only", async () => {
    const calls = api({
      [PREVIEW]: [preview()],
      [JOIN]: [{ status: 201, body: { membership: membership() } }],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    expect(await screen.findByText("Ring One Boxing")).toBeOnTheScreen();
    expect(calls.map((call) => call.key)).toEqual([PREVIEW]);
    expect(calls[0]!.body).toEqual({ code: CODE });

    await submit();
    expect(await screen.findByText("Request sent to Ring One Boxing")).toBeOnTheScreen();
    expect(calls.filter((call) => call.key === JOIN)).toHaveLength(1);
    expect(calls.find((call) => call.key === JOIN)!.body).toEqual({ code: CODE });
    expect(calls.every((call) => !call.url.includes("ABCD"))).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("the backend's answer decides, whatever the preview hinted", async () => {
    api({
      [PREVIEW]: [preview(true)],
      [JOIN]: [
        {
          status: 201,
          body: { membership: membership({ status: "active", auto_approved: true }) },
        },
      ],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Open classes" }));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/me/gyms/${GYM}/classes`);
  });

  it("an unknown or malformed code gets one answer, and the typed code stays", async () => {
    api({ [PREVIEW]: [error(404, "not_found")] });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp("nonsense");
    expect(await screen.findByText(/couldn't find a gym with that code/)).toBeOnTheScreen();
    expect(screen.getByTestId("member-join-code").props.value).toBeTruthy();
    expect(screen.queryByTestId("member-join-submit")).toBeNull();
  });

  it("a rate limit says how long, from the server", async () => {
    const calls = api({
      [PREVIEW]: [{ ...error(429, "rate_limited"), headers: { "retry-after": "120" } }],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    expect(await screen.findByText(/Too many attempts/)).toBeOnTheScreen();
    expect(calls).toHaveLength(1);
  });

  it("a lost preview keeps the code and claims nothing", async () => {
    api({ [PREVIEW]: [new TypeError("offline")] });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    expect(await screen.findByText(/couldn't confirm that/)).toBeOnTheScreen();
    expect(screen.getByTestId("member-join-code").props.value).toBe(CODE);
  });

  it("a lost join answer reads the memberships: the request landed, so it says so", async () => {
    const calls = api({
      [PREVIEW]: [preview()],
      [JOIN]: [new TypeError("offline")],
      [MEMBERSHIPS]: [rows([membership()])],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    expect(await screen.findByText("Request sent to Ring One Boxing")).toBeOnTheScreen();
    expect(calls.filter((call) => call.key === JOIN)).toHaveLength(1);
    expect(calls.some((call) => call.key === MEMBERSHIPS)).toBe(true);
  });

  it("a lost join that didn't land claims nothing and lets the person try again", async () => {
    const calls = api({
      [PREVIEW]: [preview()],
      [JOIN]: [new TypeError("offline"), { status: 201, body: { membership: membership() } }],
      [MEMBERSHIPS]: [rows([])],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    expect(await screen.findByText(/couldn't confirm that/)).toBeOnTheScreen();
    expect(screen.queryByText("Request sent to Ring One Boxing")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("member-join-submit")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("member-join-submit"));
    expect(await screen.findByText("Request sent to Ring One Boxing")).toBeOnTheScreen();
    expect(calls.filter((call) => call.key === JOIN)).toHaveLength(2);
  });

  it("already a member", async () => {
    api({
      [PREVIEW]: [preview()],
      [JOIN]: [error(409, "conflict", { gym_member: "already_active" })],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    expect(await screen.findByText("You're already a member of this gym")).toBeOnTheScreen();
  });

  it("a code rotated between preview and joining gets the same answer", async () => {
    api({ [PREVIEW]: [preview()], [JOIN]: [error(404, "not_found")] });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    expect(await screen.findByText(/couldn't find a gym with that code/)).toBeOnTheScreen();
  });

  it("an unfinished account goes to the entry and comes back, without the code", async () => {
    api({
      [PREVIEW]: [preview()],
      [JOIN]: [
        error(422, "validation_error", { field_codes: { account_registration: ["required"] } }),
      ],
    });
    await renderWithProviders(<MemberJoinScreen />);
    await lookUp();
    await submit();
    await fireEvent.press(await screen.findByRole("button", { name: "Finish my account" }));
    const target = JSON.stringify(mockRouter.replace.mock.calls[0]);
    expect(target).toContain("returnTo");
    expect(target).not.toContain("ABCD");
  });
});

describe("MemberInvitationsScreen (SF-135)", () => {
  it("opening accepts nothing; accepting is by id and reads the list again", async () => {
    const calls = api({
      [INBOX]: [inbox([invitation()]), inbox([invitation({ status: "accepted" })])],
      [ACCEPT]: [
        {
          status: 200,
          body: {
            invitation: invitation(),
            gym_id: GYM,
            gym_member_id: MEMBER,
            outcome: "accepted",
          },
        },
      ],
      [MEMBERSHIPS]: [rows([])],
    });
    await renderWithProviders(<MemberInvitationsScreen />);
    const row = await screen.findByTestId(`member-invitation-${INVITE}`);
    expect(within(row).getByText("Invited by Yauheni")).toBeOnTheScreen();
    expect(calls.some((call) => call.key === ACCEPT)).toBe(false);

    await fireEvent.press(within(row).getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("You're a member of Ring One Boxing.")).toBeOnTheScreen();
    expect(await screen.findByText("You accepted this invitation")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Open classes" }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/me/gyms/${GYM}/classes`);
  });

  it("declining asks first", async () => {
    const calls = api({
      [INBOX]: [inbox([invitation()]), inbox([invitation({ status: "declined" })])],
      [DECLINE]: [{ status: 200, body: { invitation: invitation({ status: "declined" }) } }],
      [MEMBERSHIPS]: [rows([])],
    });
    await renderWithProviders(<MemberInvitationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Decline" }));
    expect(await screen.findByText("Decline this invitation?")).toBeOnTheScreen();
    expect(calls.some((call) => call.key === DECLINE)).toBe(false);
    await fireEvent.press(screen.getAllByRole("button", { name: "Decline" }).at(-1)!);
    expect(
      await screen.findByText("You declined the invitation from Ring One Boxing."),
    ).toBeOnTheScreen();
    expect(calls.filter((call) => call.key === DECLINE)).toHaveLength(1);
  });

  it.each([
    ["expired", /This invitation has expired/],
    ["cancelled", "The gym withdrew this invitation"],
    ["accepted", "You accepted this invitation"],
    ["declined", "You declined this invitation"],
  ] as const)("%s says so and offers no answer", async (status, line) => {
    api({ [INBOX]: [inbox([invitation({ status })])] });
    await renderWithProviders(<MemberInvitationsScreen />);
    expect(await screen.findByText(line)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });

  it("withdrawn meanwhile: says it changed, and the list shows the truth", async () => {
    const calls = api({
      [INBOX]: [inbox([invitation()])],
      [ACCEPT]: [error(410, "invitation_unavailable")],
      [MEMBERSHIPS]: [rows([])],
    });
    await renderWithProviders(<MemberInvitationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/changed in the meantime/)).toBeOnTheScreen();
    await waitFor(() =>
      expect(calls.filter((call) => call.key === INBOX).length).toBeGreaterThan(1),
    );
  });

  it("a lost answer claims nothing; a repeat is safe", async () => {
    api({
      [INBOX]: [inbox([invitation()])],
      [ACCEPT]: [new TypeError("offline")],
      [MEMBERSHIPS]: [rows([])],
    });
    await renderWithProviders(<MemberInvitationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/couldn't confirm that/)).toBeOnTheScreen();
    expect(screen.queryByText("You're a member of Ring One Boxing.")).toBeNull();
  });

  it("reads every page", async () => {
    const second = invitation({ invitation_id: "7a1b2c3d-0000-4000-8000-000000000702" });
    api({ [INBOX]: [inbox([invitation()], "page-2"), inbox([second])] });
    await renderWithProviders(<MemberInvitationsScreen />);
    await screen.findByTestId(`member-invitation-${second.invitation_id}`);
    expect(screen.getByTestId(`member-invitation-${INVITE}`)).toBeOnTheScreen();
  });

  it("an empty inbox still offers another address and joining", async () => {
    api({ [INBOX]: [inbox([])] });
    await renderWithProviders(<MemberInvitationsScreen />);
    expect(await screen.findByText("No invitations right now")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("member-invitations-missing"));
    expect(mockRouter.push).toHaveBeenCalledWith("/me/gyms/invitations/verify-email");
  });

  it("a failed list offers a retry", async () => {
    api({ [INBOX]: [new TypeError("offline"), inbox([])] });
    await renderWithProviders(<MemberInvitationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No invitations right now")).toBeOnTheScreen();
  });
});

describe("MemberGymsScreen's actions (SF-135)", () => {
  it("every status from the backend: history opens nothing and offers nothing", async () => {
    api({
      [MEMBERSHIPS]: [
        rows([
          membership({
            gym_member_id: "8b1b2c3d-0000-4000-8000-000000000009",
            status: "ended",
            ended_at: "2026-10-31T10:00:00Z",
            ended_reason: "removed",
            gym: { gym_id: "3d0a7f52-1c8e-4b6a-9f20-5e7d1b3c9a66", name: "Old Gym" },
          }),
        ]),
      ],
      [INBOX]: [inbox([invitation()])],
    });
    await renderWithProviders(<MemberGymsScreen />);
    expect(await screen.findByText(/The gym ended this membership/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Old Gym/ })).toBeNull();
    expect(await screen.findByRole("button", { name: "Invitations (1)" })).toBeOnTheScreen();
    expect(screen.getByText("You’re not a member of a gym")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("member-join"));
    expect(mockRouter.push).toHaveBeenCalledWith("/me/gyms/join");
  });

  it("cancelling a request asks first, then shows the backend's status", async () => {
    const cancel = `POST /api/v1/me/gym-memberships/${MEMBER}/cancel`;
    const calls = api({
      [MEMBERSHIPS]: [
        rows([membership()]),
        rows([membership({ status: "cancelled", responded_at: "2026-10-31T10:00:00Z" })]),
      ],
      [INBOX]: [inbox([])],
      [cancel]: [{ status: 200, body: { membership: membership({ status: "cancelled" }) } }],
    });
    await renderWithProviders(<MemberGymsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Cancel request" }));
    expect(await screen.findByText("Cancel this request?")).toBeOnTheScreen();
    expect(calls.some((call) => call.key === cancel)).toBe(false);
    await fireEvent.press(screen.getAllByRole("button", { name: "Cancel request" }).at(-1)!);
    expect(await screen.findByText(/You cancelled this request/)).toBeOnTheScreen();
  });

  it("leaving says bookings end; a refusal stays in the sheet", async () => {
    const leave = `POST /api/v1/me/gym-memberships/${MEMBER}/leave`;
    api({
      [MEMBERSHIPS]: [rows([membership({ status: "active" })])],
      [INBOX]: [inbox([])],
      [leave]: [error(409, "conflict", { gym_member: "ended" })],
    });
    await renderWithProviders(<MemberGymsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Leave" }));
    expect(
      await screen.findByText(/upcoming bookings at this gym are cancelled/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Leave gym" }));
    expect(await screen.findByText(/changed in the meantime/)).toBeOnTheScreen();
  });
});
