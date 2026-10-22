import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { InvitationsScreen } from "./invitations-screen";
import { VerifyEmailScreen } from "./verify-email-screen";

/*
 * FCI1 "Missing an invitation?" and FCI3 Verify an email (SF-79) on the
 * SF-77 API, with the real session layer and the network mocked at `fetch`.
 * The backend decides every outcome; a 202 is never a link; the code never
 * leaves component state; a session boundary ends the flow.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const OTHER = { id: "5f1d2a3b-0000-4c41-9b7e-0d4f6a2b8c99", created_at: "2026-10-02T10:00:00Z" };
const EMAIL = "fighter@example.com";
// Canary code: never in a route, storage, the console or another request.
const CODE = "730419";
const REQUEST = "POST /api/v1/me/email-identities/link-challenge";
const CONFIRM = "POST /api/v1/me/email-identities/confirm-link";
const LIST = "GET /api/v1/me/email-identities";
const INBOX = "GET /api/v1/me/coach-invitations";

const accepted = () =>
  jsonResponse({ expires_in_seconds: 600, resend_after_seconds: 60 }, { status: 202 });
const linked = (outcome = "linked") =>
  jsonResponse({ outcome, email_identity: { email: EMAIL, linked_at: "2026-10-22T10:00:00Z" } });
const error = (status: number, code: string, headers: Record<string, string> = {}) =>
  jsonResponse(
    { error: { code, message: "English text clients never show", details: {}, request_id: "r" } },
    { status, headers },
  );

type Call = { method: string; path: string; body: unknown; authorization: string | null };
type Reply = Response | ((call: Call) => Response | Promise<Response>);

/** `fetch` by `METHOD /path`; a list answers in order, its last answer repeating. */
function backend(routes: Record<string, Reply | Reply[]>, viewer = VIEWER) {
  const calls: Call[] = [];
  const queues = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  );
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const call = {
        method: (init.method ?? "GET").toUpperCase(),
        path: new URL(url).pathname,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
        authorization: headers.get("authorization"),
      };
      calls.push(call);
      if (call.path === "/api/me") return Promise.resolve(jsonResponse({ user: viewer }));
      const key = `${call.method} ${call.path}`;
      const entry = queues.get(key);
      const reply = Array.isArray(entry) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
      if (reply === undefined) throw new Error(`unexpected ${key}`);
      return Promise.resolve(typeof reply === "function" ? reply(call) : reply.clone());
    }),
  );
  return calls;
}
const of = (calls: Call[], key: string) =>
  calls.filter((call) => `${call.method} ${call.path}` === key);

const user = userEvent.setup();
const log = jest.spyOn(console, "log");
const warn = jest.spyOn(console, "warn");

async function signIn(viewer = VIEWER, token = "sfa_test") {
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: viewer }))));
  await completeAuthentication({
    access_token: token,
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: `sfr_${token}`,
  });
}

beforeEach(async () => {
  resetSessionForTests();
  jest.clearAllMocks();
  await signIn();
});

afterEach(async () => {
  // 23: the code never in a route, SecureStore, AsyncStorage or the console.
  for (const call of [...mockRouter.push.mock.calls, ...mockRouter.replace.mock.calls]) {
    expect(JSON.stringify(call)).not.toContain(CODE);
  }
  // The storage boundary forbids importing the stores; their Jest mocks are read instead.
  const secure = jest.requireMock<{ __store: Map<string, string> }>("expo-secure-store").__store;
  expect(JSON.stringify([...secure.entries()])).not.toContain(CODE);
  const preferences = jest.requireMock<{
    getAllKeys(): Promise<readonly string[]>;
    multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]>;
  }>("@react-native-async-storage/async-storage");
  const keys = await preferences.getAllKeys();
  expect(JSON.stringify(await preferences.multiGet(keys))).not.toContain(CODE);
  expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls])).not.toContain(CODE);
});

async function toCode() {
  await user.type(await screen.findByLabelText("Email address"), EMAIL);
  await user.press(screen.getByRole("button", { name: "Send code" }));
  return screen.findByLabelText("6-digit code");
}

describe("FCI1 entry (SF-79)", () => {
  it("offers to verify another email under an empty inbox and under a list; nothing starts by itself", async () => {
    const calls = backend({ [INBOX]: jsonResponse({ invitations: [], next_cursor: null }) });
    await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText("No invitations")).toBeOnTheScreen();
    expect(screen.getByText("Missing an invitation?")).toBeOnTheScreen();
    expect(calls.some((call) => call.path.includes("email-identities"))).toBe(false);

    await user.press(screen.getByRole("button", { name: "Add the email it was sent to" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/profile/coaches/invitations/verify-email");
  });
});

describe("invitation continuation (SF-79)", () => {
  const pending = {
    invitation_id: "3c1e9d1a-5a0e-4c41-9b7e-0d4f6a2b8c11",
    status: "pending",
    coach: { display_name: "Coach Marek", brand_name: "Marek Boxing" },
    message: null,
    created_at: "2026-10-20T10:00:00Z",
    expires_at: "2026-10-30T10:00:00Z",
    responded_at: null,
  };

  it("18/21: after linking the inbox is read again and shows the invitation; nothing is accepted", async () => {
    const calls = backend({
      [REQUEST]: accepted(),
      [CONFIRM]: linked(),
      [LIST]: jsonResponse({ email_identities: [] }),
      [INBOX]: [
        jsonResponse({ invitations: [], next_cursor: null }),
        jsonResponse({ invitations: [pending], next_cursor: null }),
      ],
    });
    // One tree: FCI3 over FCI1 share the query cache as in the stack.
    await renderWithProviders(
      <>
        <InvitationsScreen />
        <VerifyEmailScreen />
      </>,
    );
    expect(await screen.findByText("No invitations")).toBeOnTheScreen();
    await user.type(await toCode(), CODE);
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();

    expect(
      await screen.findByRole("button", { name: /^Coach Marek, Pending, Marek Boxing · expires/ }),
    ).toBeOnTheScreen();
    expect(of(calls, INBOX)).toHaveLength(2);
    expect(calls.some((call) => /\/accept$|\/decline$/.test(call.path))).toBe(false);
  });

  it("20: with sharing off the inbox is unavailable and offers no linking", async () => {
    backend({ [INBOX]: error(404, "not_found") });
    await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText("Invitations aren’t available")).toBeOnTheScreen();
    expect(screen.queryByText("Missing an invitation?")).toBeNull();
  });
});

describe("FCI3 Verify an email (SF-79)", () => {
  it("1/3/4/22: a 202 leads to the code, never to success; the backend's answer links the same user", async () => {
    const calls = backend({ [REQUEST]: accepted(), [CONFIRM]: linked() });
    await renderWithProviders(<VerifyEmailScreen />);
    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Verify an email" });

    const field = await toCode();
    expect(screen.getByText(/It expires in 10 min\./)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Email verified" })).toBeNull();

    await user.type(field, CODE);
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
    expect(
      screen.getByText(/Invitations sent to it now appear in your invitations\./),
    ).toBeOnTheScreen();
    expect(of(calls, CONFIRM)).toHaveLength(1);
    expect(of(calls, CONFIRM)[0]?.body).toEqual({ email: EMAIL, code: CODE });
    // Only the account's own session ever asked: no other user, no new session.
    expect(new Set(calls.map((call) => call.authorization))).toEqual(new Set(["Bearer sfa_test"]));

    await user.press(screen.getByRole("button", { name: "Back to invitations" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("9: an address already on the account says so; nothing changes", async () => {
    backend({ [REQUEST]: accepted(), [CONFIRM]: linked("already_linked") });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(await screen.findByText("This email is already on your account")).toBeOnTheScreen();
  });

  it("checks the email shape before sending and keeps the server's validation", async () => {
    const calls = backend({ [REQUEST]: error(422, "validation_error") });
    await renderWithProviders(<VerifyEmailScreen />);
    const email = await screen.findByLabelText("Email address");
    await user.type(email, "not-an-email");
    await user.press(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(calls.filter((call) => call.path.includes("email-identities"))).toHaveLength(0);

    await user.clear(email);
    await user.type(email, "a@b.co");
    await user.press(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeOnTheScreen();
  });

  it("7: a rate-limited request stays on the email step", async () => {
    backend({ [REQUEST]: error(429, "rate_limited", { "retry-after": "40" }) });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await screen.findByLabelText("Email address"), EMAIL);
    await user.press(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Too many attempts. Try again shortly.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
  });

  it("5: a wrong code can be corrected", async () => {
    backend({ [REQUEST]: accepted(), [CONFIRM]: [error(422, "code_invalid"), linked()] });
    await renderWithProviders(<VerifyEmailScreen />);
    const field = await toCode();
    await user.type(field, "111111");
    expect(
      await screen.findByText("That code isn’t right. Check the digits and try again."),
    ).toBeOnTheScreen();
    await user.clear(field);
    await user.type(field, CODE);
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
  });

  it("6/8: an expired code offers a new one, which supersedes the old", async () => {
    const calls = backend({ [REQUEST]: accepted(), [CONFIRM]: error(422, "code_expired") });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(await screen.findByText("This code no longer works. Send a new one.")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Send a new code" }));
    expect(
      await screen.findByText("We sent a new code. Earlier codes no longer work."),
    ).toBeOnTheScreen();
    expect(of(calls, REQUEST)).toHaveLength(2);
    expect(screen.getByLabelText("6-digit code")).toHaveDisplayValue("");
  });

  it("7: too many wrong codes locks the step", async () => {
    backend({
      [REQUEST]: accepted(),
      [CONFIRM]: error(429, "rate_limited", { "retry-after": "30" }),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(await screen.findByText("Resend unavailable for now")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Verify email" })).toBeDisabled();
  });

  it("10: another account's address is a conflict only after the code; no merge, a way back", async () => {
    backend({ [REQUEST]: accepted(), [CONFIRM]: error(409, "conflict") });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(
      await screen.findByText(/belongs to another SimpleFit account\. Accounts are never merged\./),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
    expect(screen.queryByRole("button", { name: /merge|transfer/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out and switch account" })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Back to invitations" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("13: a refreshed access token in the same session keeps the flow and confirms", async () => {
    const calls = backend({
      [REQUEST]: accepted(),
      [CONFIRM]: [error(401, "unauthorized"), linked()],
      "POST /api/auth/session/refresh": jsonResponse({
        access_token: "sfa_rotated",
        access_token_expires_at: "2099-01-01T00:00:00Z",
        refresh_token: "sfr_rotated",
        refresh_token_expires_at: "2099-01-01T00:00:00Z",
        refresh_token_transport: "body",
        token_type: "Bearer",
      }),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
    expect(of(calls, CONFIRM).map((call) => call.authorization)).toEqual([
      "Bearer sfa_test",
      "Bearer sfa_rotated",
    ]);
  });

  it("11/G: a session that ended cannot confirm; it asks to sign in again", async () => {
    backend({
      [REQUEST]: accepted(),
      [CONFIRM]: error(401, "unauthorized"),
      "POST /api/auth/session/refresh": error(401, "unauthorized"),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(
      await screen.findByText("Your session ended. Sign in again, then request a new code."),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
    await user.press(screen.getByRole("button", { name: "Sign in again" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/login");
  });

  it("12/14: another account signing in clears the flow and the code", async () => {
    backend({ [REQUEST]: accepted() });
    await renderWithProviders(<VerifyEmailScreen />);
    const field = await toCode();
    await user.type(field, "7304");
    await act(async () => {
      await signIn(OTHER, "sfa_other");
    });
    expect(await screen.findByLabelText("Email address")).toHaveDisplayValue("");
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
  });

  it("15: a lost confirmation answer is reconciled with the identity list, without resubmitting", async () => {
    const calls = backend({
      [REQUEST]: accepted(),
      [CONFIRM]: () => Promise.reject(new TypeError("Network request failed")),
      [LIST]: jsonResponse({
        email_identities: [{ email: EMAIL, linked_at: "2026-10-22T10:00:00Z" }],
      }),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
    expect(of(calls, CONFIRM)).toHaveLength(1);
    expect(of(calls, LIST)).toHaveLength(1);
  });

  it("15: when the list does not show it, success is not claimed; retry re-reads the list first", async () => {
    const calls = backend({
      [REQUEST]: accepted(),
      [CONFIRM]: [() => Promise.reject(new TypeError("Network request failed")), linked()],
      [LIST]: jsonResponse({ email_identities: [] }),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    expect(
      await screen.findByText("We couldn’t confirm the code. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Email verified" })).toBeNull();
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
    const order = calls
      .filter((call) => call.path.includes("email-identities"))
      .map((call) =>
        call.method === "GET" ? "list" : call.path.endsWith("confirm-link") ? "confirm" : "request",
      );
    expect(order).toEqual(["request", "confirm", "list", "list", "confirm"]);
  });

  it("T: repeated presses while a confirmation is pending send one request", async () => {
    let answer: (response: Response) => void = () => undefined;
    const calls = backend({
      [REQUEST]: accepted(),
      [CONFIRM]: () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), CODE);
    const pending = await screen.findByRole("button", { name: "Verifying…" });
    expect(pending).toBeDisabled();
    await user.press(pending);
    expect(of(calls, CONFIRM)).toHaveLength(1);
    await act(async () => answer(linked()));
    expect(await screen.findByRole("header", { name: "Email verified" })).toBeOnTheScreen();
  });

  it("17: a cold start begins at the email step; no code survives", async () => {
    backend({ [REQUEST]: accepted() });
    const first = await renderWithProviders(<VerifyEmailScreen />);
    await user.type(await toCode(), "7304");
    await first.unmount();
    await renderWithProviders(<VerifyEmailScreen />);
    expect(await screen.findByLabelText("Email address")).toHaveDisplayValue("");
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
  });

  it("16: back in the foreground, the resend countdown reflects the real time", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    try {
      backend({ [REQUEST]: accepted() });
      await renderWithProviders(<VerifyEmailScreen />);
      const fake = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await fake.type(await screen.findByLabelText("Email address"), EMAIL);
      await fake.press(screen.getByRole("button", { name: "Send code" }));
      expect(await screen.findByText(/Resend in 1:00|Resend in 0:59/)).toBeOnTheScreen();
      // The app was suspended for 70 s: the first tick after it shows the real state.
      await act(async () => {
        jest.setSystemTime(Date.now() + 70_000);
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Send a new code" })).toBeOnTheScreen(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("opening the screen sends nothing; the native back leaves", async () => {
    const calls = backend({});
    await renderWithProviders(<VerifyEmailScreen />);
    await screen.findByLabelText("Email address");
    expect(calls.filter((call) => call.path.includes("email-identities"))).toHaveLength(0);
  });
});
