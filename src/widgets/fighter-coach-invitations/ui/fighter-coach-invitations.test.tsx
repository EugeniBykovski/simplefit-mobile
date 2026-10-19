import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { InvitationReviewScreen } from "./invitation-review-screen";
import { InvitationsScreen } from "./invitations-screen";

/*
 * FCI1 Invitations and FCI2 Invitation review (SF-76) on the SF-73 id-based
 * endpoints and the SF-72 acceptance policy, with the network mocked at
 * `fetch`. Only what the backend returns is shown; a legal-gate `404` is
 * never an empty inbox; acceptance needs the explicit confirmation and sends
 * exactly the version and language shown; every outcome is the backend's.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => true),
};
const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };
const INBOX = "/api/v1/me/coach-invitations";
const ID = "3c1e9d1a-5a0e-4c41-9b7e-0d4f6a2b8c11";
const PREVIEW = `${INBOX}/${ID}/preview`;
const ACCEPT = `${INBOX}/${ID}/accept`;
const DECLINE = `${INBOX}/${ID}/decline`;

const coach = {
  display_name: "Coach Marek",
  brand_name: "Marek Boxing",
  // Privacy canaries: never part of the DTO; must never render even if sent.
  email: "coach@private.example",
};
const invitation = (status: string, extra = {}) => ({
  invitation_id: ID,
  status,
  coach,
  message: "Saturday sparring is on",
  created_at: "2026-10-10T10:00:00Z",
  expires_at: "2026-10-24T10:00:00Z",
  responded_at: null,
  // Canaries: the inbox never exposes these; the app must not render them.
  token: "sfi_secret_token",
  recipient_digest: "digest-canary",
  ...extra,
});
const page = (invitations: unknown[], next_cursor: string | null = null) =>
  jsonResponse({ invitations, next_cursor });

const DOCUMENT = {
  document_id: "fighter-coach-disclosure",
  version: "fighter-coach-disclosure-test-1",
  status: "published",
  effective_at: null,
  published_at: null,
  requested_language: "en",
  language: "en",
  available_languages: ["en", "pl"],
  content_sha256: "a".repeat(64),
  title: "TEST disclosure title",
  summary: "TEST summary for {coach}.",
  checkbox: "TEST I agree that {coach} sees these fields.",
  full: "# TEST full text\n\nTEST paragraph.",
};
const preview = (document: unknown = DOCUMENT) =>
  jsonResponse({
    invitation: { coach, message: "Saturday sparring is on", expires_at: "2026-10-24T10:00:00Z" },
    disclosure: {
      version: "fighter-coach-disclosure-test-1",
      fields: ["display_name", "username", "stance"],
      never_shared: ["goals", "weight", "date_of_birth", "email"],
    },
    document,
  });
const error = (status: number, code: string, details: Record<string, unknown> = {}) =>
  jsonResponse(
    { error: { code, message: "English text clients never show", details, request_id: "r" } },
    { status },
  );

type Call = { method: string; path: string; query: URLSearchParams; body: unknown };
type Reply = Response | ((call: Call) => Response | Promise<Response>);

/** `fetch` routed by `METHOD /path`; every request is recorded. */
function backend(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const parsed = new URL(url);
      const call = {
        method: (init.method ?? "GET").toUpperCase(),
        path: parsed.pathname,
        query: parsed.searchParams,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
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
const api = (calls: Call[]) => calls.filter((call) => call.path !== "/api/me");

const user = userEvent.setup();

beforeEach(async () => {
  resetSessionForTests();
  jest.clearAllMocks();
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Invitations (FCI1)", () => {
  it("lists the backend's invitations; only pending ones open, by id", async () => {
    const calls = backend({
      [`GET ${INBOX}`]: page([
        invitation("pending"),
        invitation("accepted", {
          invitation_id: "b2",
          coach: { display_name: "Alex Novak", brand_name: null },
          responded_at: "2026-10-12T10:00:00Z",
        }),
        invitation("expired", {
          invitation_id: "b3",
          coach: { display_name: null, brand_name: "Pat Gym" },
        }),
      ]),
    });
    await renderWithProviders(<InvitationsScreen />);

    const pending = await screen.findByRole("button", {
      name: /^Coach Marek, Pending, Marek Boxing · expires/,
    });
    expect(screen.getByLabelText(/^Alex Novak, Accepted, Accepted /)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Pat Gym, Expired, Expired /)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Alex Novak|Pat Gym/ })).toBeNull();
    expect(screen.queryByText(/sfi_|digest-canary|coach@private/)).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Invitations" });

    await user.press(pending);
    expect(mockRouter.push).toHaveBeenCalledWith(`/profile/coaches/invitations/${ID}`);
    expect(api(calls)).toHaveLength(1);
  });

  it("tells an empty inbox apart from sharing being off (404) and the account first (422)", async () => {
    backend({ [`GET ${INBOX}`]: page([]) });
    const first = await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText("No invitations")).toBeOnTheScreen();
    await first.unmount();

    backend({ [`GET ${INBOX}`]: error(404, "not_found") });
    const second = await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText("Invitations aren’t available")).toBeOnTheScreen();
    expect(screen.queryByText("No invitations")).toBeNull();
    await second.unmount();

    backend({
      [`GET ${INBOX}`]: error(422, "validation_error", {
        field_codes: { account_registration: ["required"] },
      }),
    });
    await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText("Finish your account to see invitations")).toBeOnTheScreen();
    expect(screen.queryByText("No invitations")).toBeNull();
  });

  it("never shows 'No invitations' when the request failed, and retries", async () => {
    let fail = true;
    backend({
      [`GET ${INBOX}`]: () => (fail ? error(500, "internal_error") : page([invitation("pending")])),
    });
    await renderWithProviders(<InvitationsScreen />);
    expect(await screen.findByText(/We couldn’t load your invitations\./)).toBeOnTheScreen();
    expect(screen.queryByText("No invitations")).toBeNull();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Coach Marek")).toBeOnTheScreen();
  });

  it("pages with the backend cursor", async () => {
    const calls = backend({
      [`GET ${INBOX}`]: ({ query }) =>
        query.get("cursor") === "c2"
          ? page([invitation("declined", { invitation_id: "b9", responded_at: null })])
          : page([invitation("pending")], "c2"),
    });
    await renderWithProviders(<InvitationsScreen />);
    await user.press(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByTestId("invitation:declined")).toBeOnTheScreen();
    expect(api(calls).map((call) => call.query.get("cursor"))).toEqual([null, "c2"]);
  });
});

async function tickAndAccept() {
  await user.press(
    await screen.findByRole("checkbox", {
      name: "TEST I agree that Coach Marek sees these fields.",
    }),
  );
  await user.press(screen.getByRole("button", { name: "Accept invitation" }));
}

describe("Invitation review (FCI2)", () => {
  it("shows the invitation and the backend's approved disclosure, in the app language", async () => {
    const calls = backend({ [`GET ${PREVIEW}`]: preview() });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);

    expect(
      await screen.findByRole("header", {
        name: "Coach Marek invited you to connect on SimpleFit.",
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Marek Boxing")).toBeOnTheScreen();
    expect(screen.getByText("“Saturday sparring is on” — Coach Marek")).toBeOnTheScreen();
    for (const label of ["Display name", "Username", "Stance"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.queryByText("City")).toBeNull();
    expect(screen.getByText("Goals · Weight · Date of birth · Email address")).toBeOnTheScreen();
    expect(
      screen.getByText("Disclosure · fighter-coach-disclosure-test-1 · English"),
    ).toBeOnTheScreen();
    expect(screen.getByText("TEST disclosure title")).toBeOnTheScreen();
    expect(screen.getByText("TEST summary for Coach Marek.")).toBeOnTheScreen();
    expect(screen.queryByText(/coach@private/)).toBeNull();
    expect(api(calls)[0]?.query.get("language")).toBe("en");

    await user.press(screen.getByRole("button", { name: "Read the full disclosure" }));
    expect(await screen.findByText("TEST paragraph.")).toBeOnTheScreen();
  });

  it("accepts only after the explicit confirmation, with exactly the version and language shown", async () => {
    const calls = backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${ACCEPT}`]: jsonResponse({ outcome: "created", relationship_id: "r1" }),
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    const accept = await screen.findByRole("button", { name: "Accept invitation" });
    expect(accept).toBeDisabled();
    await user.press(accept);
    expect(api(calls).some((call) => call.method === "POST")).toBe(false);

    await tickAndAccept();
    expect(await screen.findByText("You’re connected with Coach Marek.")).toBeOnTheScreen();
    const posts = api(calls).filter((call) => call.method === "POST");
    expect(posts).toEqual([
      expect.objectContaining({
        path: ACCEPT,
        body: { disclosure_version: "fighter-coach-disclosure-test-1", document_language: "en" },
      }),
    ]);

    await user.press(screen.getByRole("button", { name: "Go to Coaches" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/profile/coaches");
  });

  it("reports an existing relationship as already connected", async () => {
    backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${ACCEPT}`]: jsonResponse({ outcome: "already_connected", relationship_id: "r1" }),
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await tickAndAccept();
    expect(await screen.findByText("You’re already connected with Coach Marek.")).toBeOnTheScreen();
  });

  it("never offers acceptance in another language, and still allows declining", async () => {
    backend({
      [`GET ${PREVIEW}`]: preview({
        ...DOCUMENT,
        requested_language: "de",
        language: null,
        title: null,
        summary: null,
        checkbox: null,
        full: null,
        content_sha256: null,
      }),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    expect(
      await screen.findByText(/This disclosure isn’t available in your language yet\./),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Approved languages: English, Polski\./)).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept invitation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
  });

  it("shows that no disclosure is published, and allows declining only", async () => {
    backend({ [`GET ${PREVIEW}`]: preview(null) });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    expect(await screen.findByText(/Accepting isn’t available yet\./)).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("asks to agree again when the disclosure changed (409), with the box unticked", async () => {
    let version = "fighter-coach-disclosure-test-1";
    const calls = backend({
      [`GET ${PREVIEW}`]: () =>
        jsonResponse({
          invitation: { coach, message: null, expires_at: "2026-10-24T10:00:00Z" },
          disclosure: { version, fields: ["display_name"], never_shared: ["goals"] },
          document: { ...DOCUMENT, version },
        }),
      [`POST ${ACCEPT}`]: () => {
        version = "fighter-coach-disclosure-test-2";
        return error(409, "conflict", { disclosure_version: "stale" });
      },
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await tickAndAccept();
    expect(await screen.findByText(/What you would share has changed\./)).toBeOnTheScreen();
    expect(
      await screen.findByText("Disclosure · fighter-coach-disclosure-test-2 · English"),
    ).toBeOnTheScreen();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
    expect(api(calls).filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it.each([
    [
      "under 18 (422)",
      error(422, "validation_error", { field_codes: { coaching_age: ["too_young"] } }),
      /Coach connections are for fighters aged 18 and over\./,
      false,
    ],
    [
      "profile first (422)",
      error(422, "validation_error", { field_codes: { fighter_profile: ["required"] } }),
      /Finish your profile to respond\./,
      false,
    ],
    ["rate limited (429)", error(429, "rate_limited"), /Too many attempts\./, true],
    ["a failure", error(500, "internal_error"), /That didn’t work\./, true],
  ])("reports %s and creates nothing", async (_case, reply, text, canRetry) => {
    backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${ACCEPT}`]: reply,
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await tickAndAccept();
    expect(await screen.findByText(text)).toBeOnTheScreen();
    expect(screen.queryByText(/You’re connected/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept invitation" }) !== null).toBe(canRetry);
    expect(screen.getByRole("button", { name: "Decline" })).toBeOnTheScreen();
  });

  it.each([
    [
      "no longer pending (410)",
      error(410, "invitation_unavailable"),
      "This invitation isn’t available",
    ],
    [
      "sharing turned off (404)",
      error(404, "not_found"),
      "Coach connections aren’t available right now.",
    ],
  ])("ends the review when the invitation is %s", async (_case, reply, title) => {
    backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${ACCEPT}`]: reply,
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await tickAndAccept();
    expect(await screen.findByText(title)).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("declines only after confirmation and the backend's 204, one request at a time", async () => {
    let answer: (response: Response) => void = () => undefined;
    const calls = backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${DECLINE}`]: () => new Promise<Response>((resolve) => (answer = resolve)),
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Decline" }));
    expect(await screen.findByText("Decline the invitation from Coach Marek?")).toBeOnTheScreen();
    await user.press(screen.getAllByRole("button", { name: "Keep" }).at(-1)!);
    expect(api(calls).some((call) => call.method === "POST")).toBe(false);

    await user.press(screen.getByRole("button", { name: "Decline" }));
    const confirm = await screen.findAllByRole("button", { name: "Decline" });
    await user.press(confirm.at(-1)!);
    const pending = await screen.findAllByRole("button", { name: "Declining…" });
    await user.press(pending.at(-1)!);
    expect(api(calls).filter((call) => call.method === "POST")).toHaveLength(1);

    await act(async () => answer(new Response(null, { status: 204 })));
    expect(await screen.findByText("Invitation declined")).toBeOnTheScreen();
    expect(screen.getByText("Nothing was shared with Coach Marek.")).toBeOnTheScreen();
    expect(
      api(calls)
        .filter((call) => call.method === "POST")
        .map((call) => call.path),
    ).toEqual([DECLINE]);
    // No relationship is created or read: the coaches are not touched.
    expect(api(calls).some((call) => call.path.startsWith("/api/v1/me/coaches"))).toBe(false);
  });

  it("never shows an already answered invitation as declined (410)", async () => {
    backend({
      [`GET ${PREVIEW}`]: preview(),
      [`POST ${DECLINE}`]: error(410, "invitation_unavailable"),
      [`GET ${INBOX}`]: page([]),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Decline" }));
    const confirm = await screen.findAllByRole("button", { name: "Decline" });
    await user.press(confirm.at(-1)!);
    expect(await screen.findByText("This invitation isn’t available")).toBeOnTheScreen();
    expect(screen.queryByText("Invitation declined")).toBeNull();
  });

  it("keeps the decline sheet open on a failure, and changes nothing", async () => {
    backend({ [`GET ${PREVIEW}`]: preview(), [`POST ${DECLINE}`]: error(500, "internal_error") });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    await user.press(await screen.findByRole("button", { name: "Decline" }));
    const confirm = await screen.findAllByRole("button", { name: "Decline" });
    await user.press(confirm.at(-1)!);
    expect(
      await screen.findByText("That didn’t work. Nothing changed. Try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Invitation declined")).toBeNull();
  });

  it("shows sharing off (404) as its own state, where declining stays possible", async () => {
    const calls = backend({
      [`GET ${PREVIEW}`]: error(404, "not_found"),
      [`POST ${DECLINE}`]: new Response(null, { status: 204 }),
      [`GET ${INBOX}`]: error(404, "not_found"),
    });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    expect(
      await screen.findByText("Coach connections aren’t available right now."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("No invitations")).toBeNull();
    await user.press(screen.getByRole("button", { name: "Decline" }));
    const confirm = await screen.findAllByRole("button", { name: "Decline" });
    await user.press(confirm.at(-1)!);
    expect(await screen.findByText("Invitation declined")).toBeOnTheScreen();
    expect(api(calls).filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("shows one not-available state for an unknown or someone else's id (410)", async () => {
    backend({ [`GET ${PREVIEW}`]: error(410, "invitation_unavailable") });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    expect(await screen.findByText("This invitation isn’t available")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
    await user.press(screen.getByRole("button", { name: "Back to invitations" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/profile/coaches/invitations");
  });

  it("retries a failed read without calling it unavailable", async () => {
    let fail = true;
    backend({ [`GET ${PREVIEW}`]: () => (fail ? error(500, "internal_error") : preview()) });
    await renderWithProviders(<InvitationReviewScreen invitationId={ID} />);
    expect(await screen.findByText("We couldn’t load the invitation.")).toBeOnTheScreen();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("TEST disclosure title")).toBeOnTheScreen();
  });

  it.each(["", "sfi_secret_token", `${ID}/accept`, "../coaches"])(
    "never sends a malformed id (%j) to the API",
    async (id) => {
      const calls = backend({});
      await renderWithProviders(<InvitationReviewScreen invitationId={id} />);
      expect(await screen.findByText("This invitation isn’t available")).toBeOnTheScreen();
      await waitFor(() => expect(api(calls)).toEqual([]));
    },
  );
});
