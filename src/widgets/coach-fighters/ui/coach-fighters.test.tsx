import { act, fireEvent, screen, userEvent, waitFor } from "@testing-library/react-native";

import { coachFighterKey } from "@/entities/coach-fighter";
import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { CoachFighterScreen } from "./coach-fighter-screen";
import { CoachFightersScreen } from "./coach-fighters-screen";

/*
 * C03 Fighters and C04 Fighter (SF-61) on the SF-56 / SF-57 coach endpoints,
 * with the network mocked at `fetch`. Only what the backend returns is shown,
 * unavailable (404) is never an empty list, an invitation is never a fighter,
 * and nothing is reported done before the backend answers.
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
const FIGHTERS = "/api/v1/me/coach/fighters";
const INVITATIONS = "/api/v1/me/coach/invitations";
const RULES = "/api/v1/me/coach/data-rules";

const fighter = (id: string, name: string, extra = {}) => ({
  relationship_id: id,
  status: "active",
  started_at: "2026-09-01T10:00:00Z",
  ended_at: null,
  ended_by: null,
  disclosure_version: "test-disclosure",
  disclosed_fields: ["display_name", "username", "city", "country_code", "stance"],
  fighter: {
    display_name: name,
    username: name.toLowerCase().replace(/\W+/g, "_"),
    city: "Warsaw",
    country_code: "PL",
    experience_level: null,
    stance: "southpaw",
    amateur_bout_count: null,
    // Privacy canaries: never part of the DTO; must never render even if sent.
    email: "fighter@private.example",
    date_of_birth: "2001-02-03",
    current_weight_kg: 71.5,
    goals: ["canary goal"],
  },
  fighter_display_name_at_end: null,
  ...extra,
});
const ALEX = fighter("rel-1", "Alex Kowal");
const MAJA = fighter("rel-2", "Maja Nowak");
const ENDED = {
  ...fighter("rel-9", "x"),
  status: "ended",
  ended_at: "2026-10-02T10:00:00Z",
  ended_by: "fighter",
  disclosed_fields: [],
  fighter: null,
  fighter_display_name_at_end: "Sam R.",
};
const invitation = (id: string, status: string, extra = {}) => ({
  invitation_id: id,
  status,
  recipient_email: `${id[4]}•••@example.com`,
  message: null,
  created_at: "2026-10-10T10:00:00Z",
  expires_at: "2026-10-24T10:00:00Z",
  last_sent_at: "2026-10-10T10:00:00Z",
  resends_remaining: status === "pending" ? 2 : 0,
  responded_at: status === "pending" ? null : "2026-10-12T10:00:00Z",
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
const page = (relationships: unknown[], next_cursor: string | null = null) =>
  jsonResponse({ relationships, next_cursor });
const invitations = (items: unknown[]) => jsonResponse({ invitations: items, next_cursor: null });
const error = (status: number, code: string, details: Record<string, unknown> = {}, headers = {}) =>
  jsonResponse({ error: { code, message: "x", details, request_id: "r" } }, { status, headers });
// The backend's approved text (SF-72): test fixtures, never legal copy.
const document = (version: string, language: string | null = "en") => ({
  document_id: "coach-data-rules",
  version,
  status: "published",
  effective_at: "2026-01-01T00:00:00Z",
  published_at: "2026-01-01T00:00:00Z",
  requested_language: "en",
  language,
  available_languages: ["en", "pl"],
  content_sha256: language === null ? null : "a".repeat(64),
  title: language === null ? null : "Fixture rules",
  summary: language === null ? null : "Fixture summary of the rules.",
  checkbox: language === null ? null : "I will follow fixture rules {version}.",
  full: language === null ? null : "# Fixture rules\n\nFull fixture text.\n\n- First fixture item",
});
const rules = (version: string | null, acknowledged: boolean, language: string | null = "en") =>
  jsonResponse({
    data_rules: {
      document_version: version,
      acknowledged_at: acknowledged ? "2026-10-01T10:00:00Z" : null,
      document: version === null ? null : document(version, language),
    },
  });
const byStatus =
  (lists: { active?: unknown[]; ended?: unknown[] }) =>
  ({ query }: Call) =>
    page(query.get("status") === "ended" ? (lists.ended ?? []) : (lists.active ?? []));

const user = userEvent.setup();

beforeEach(async () => {
  resetSessionForTests();
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Fighters (C03) roster", () => {
  it("lists the active fighters with only their disclosed fields and opens one by relationship id", async () => {
    const calls = backend({ [`GET ${FIGHTERS}`]: byStatus({ active: [ALEX, MAJA] }) });
    await renderWithProviders(<CoachFightersScreen view="active" />);
    const alex = await screen.findByRole("button", {
      name: /^Alex Kowal, @alex_kowal · Warsaw, Poland/,
    });
    expect(screen.getByRole("button", { name: /^Maja Nowak,/ })).toBeOnTheScreen();
    expect(screen.queryByText(/private\.example|2001|71\.5|canary goal/)).toBeNull();
    await user.press(alex);
    expect(mockRouter.push).toHaveBeenCalledWith("/coach/fighters/rel-1");
    expect(
      calls.every((call) => call.path.startsWith("/api/v1/me/coach/") || call.path === "/api/me"),
    ).toBe(true);
  });

  it("tells an empty roster apart from unavailable (sharing off) and from a failure", async () => {
    backend({ [`GET ${FIGHTERS}`]: page([]) });
    const first = await renderWithProviders(<CoachFightersScreen view="active" />);
    expect(await screen.findByText("No fighters yet")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Invite fighter" })).toBeEnabled();
    await first.unmount();

    backend({ [`GET ${FIGHTERS}`]: error(404, "not_found") });
    const second = await renderWithProviders(<CoachFightersScreen view="active" />);
    expect(await screen.findByText("Fighters aren’t available yet")).toBeOnTheScreen();
    expect(screen.queryByText("No fighters yet")).toBeNull();
    expect(screen.getByRole("button", { name: "Invite fighter" })).toBeDisabled();
    await second.unmount();

    let fail = true;
    backend({
      [`GET ${FIGHTERS}`]: (call) =>
        fail ? error(500, "internal_error") : byStatus({ active: [ALEX] })(call),
    });
    await renderWithProviders(<CoachFightersScreen view="active" />);
    expect(await screen.findByText(/We couldn’t load your fighters\./)).toBeOnTheScreen();
    expect(screen.queryByText("No fighters yet")).toBeNull();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Alex Kowal")).toBeOnTheScreen();
  });

  it("lists ended relationships with the name at the end only, opening nothing", async () => {
    const calls = backend({ [`GET ${FIGHTERS}`]: byStatus({ ended: [ENDED] }) });
    await renderWithProviders(<CoachFightersScreen view="ended" />);
    expect(await screen.findByLabelText(/^Sam R\., Ended .* · by the fighter$/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Sam R\./ })).toBeNull();
    expect(
      calls.filter((call) => call.path === FIGHTERS).map((call) => call.query.get("status")),
    ).toContain("ended");
    await user.press(screen.getByRole("tab", { name: "Invitations" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/coach/fighters?view=invitations");
  });

  it("pages with the backend cursor", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}`]: ({ query }) =>
        query.get("cursor") === "c2" ? page([MAJA]) : page([ALEX], "c2"),
    });
    await renderWithProviders(<CoachFightersScreen view="active" />);
    await user.press(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Maja Nowak")).toBeOnTheScreen();
    expect(
      calls.filter((call) => call.path === FIGHTERS).map((call) => call.query.get("cursor")),
    ).toEqual(expect.arrayContaining([null, "c2"]));
  });
});

describe("Fighters (C03) invitations", () => {
  it("lists invitations apart from the roster, with actions only while pending", async () => {
    backend({
      [`GET ${FIGHTERS}`]: page([]),
      [`GET ${INVITATIONS}`]: invitations([
        invitation("inv-j", "pending"),
        invitation("inv-a", "accepted"),
      ]),
    });
    await renderWithProviders(<CoachFightersScreen view="invitations" />);
    expect(await screen.findByLabelText(/^j•••@example\.com, Pending, Sent/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^a•••@example\.com, Accepted, Accepted/)).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: /Cancel/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Resend · 2 left" })).toBeOnTheScreen();
  });

  it("cancels only after confirmation and shows the backend's status", async () => {
    let cancelled = false;
    const calls = backend({
      [`GET ${FIGHTERS}`]: page([]),
      [`GET ${INVITATIONS}`]: () =>
        invitations([
          cancelled ? invitation("inv-j", "cancelled") : invitation("inv-j", "pending"),
        ]),
      [`POST ${INVITATIONS}/inv-j/cancel`]: () => {
        cancelled = true;
        return new Response(null, { status: 204 });
      },
    });
    await renderWithProviders(<CoachFightersScreen view="invitations" />);
    await user.press(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Cancel this invitation?")).toBeOnTheScreen();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    await user.press(screen.getByRole("button", { name: "Cancel invitation" }));
    expect(await screen.findByText("Invitation to j•••@example.com cancelled.")).toBeOnTheScreen();
    expect(await screen.findByLabelText(/^j•••@example\.com, Cancelled/)).toBeOnTheScreen();
  });

  it("reports the backend's resend cooldown without retrying", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}`]: page([]),
      [`GET ${INVITATIONS}`]: invitations([invitation("inv-j", "pending")]),
      [`POST ${INVITATIONS}/inv-j/resend`]: error(429, "rate_limited", {}, { "retry-after": "42" }),
    });
    await renderWithProviders(<CoachFightersScreen view="invitations" />);
    await user.press(await screen.findByRole("button", { name: "Resend · 2 left" }));
    expect(await screen.findByText("You can resend in 42 s.")).toBeOnTheScreen();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
});

describe("Invite fighter sheet", () => {
  async function openSheet(routes: Record<string, Reply>) {
    const calls = backend({ [`GET ${FIGHTERS}`]: page([]), ...routes });
    await renderWithProviders(<CoachFightersScreen view="active" />);
    await screen.findByText("No fighters yet");
    await user.press(screen.getByRole("button", { name: "Invite fighter" }));
    return calls;
  }

  it("is truthfully blocked while no coach data-rules version is configured", async () => {
    const calls = await openSheet({ [`GET ${RULES}`]: rules(null, false) });
    expect(await screen.findByTestId("invite:blocked")).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("asks for an explicit acknowledgement of exactly the backend's version, then the form", async () => {
    let acknowledged = false;
    const calls = await openSheet({
      [`GET ${RULES}`]: () => rules("coach-data-rules-v1", acknowledged),
      [`POST ${RULES}/acknowledge`]: () => {
        acknowledged = true;
        return rules("coach-data-rules-v1", true);
      },
    });
    expect(await screen.findByText("Fixture summary of the rules.")).toBeOnTheScreen();
    const consent = screen.getByRole("checkbox", {
      name: "I will follow fixture rules coach-data-rules-v1.",
    });
    expect(consent).not.toBeChecked();
    await user.press(screen.getByRole("button", { name: "Read the full rules" }));
    expect(screen.getByText("Full fixture text.")).toBeOnTheScreen();
    expect(screen.getByText("First fixture item")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeDisabled();
    await user.press(consent);
    await user.press(screen.getByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByTestId("invite:form")).toBeOnTheScreen();
    expect(calls.find((call) => call.path === `${RULES}/acknowledge`)?.body).toEqual({
      document_version: "coach-data-rules-v1",
      document_language: "en",
    });
    expect(calls.find((call) => call.path === RULES)?.query.get("language")).toBe("en");
  });

  it("never acknowledges a text in another language: unavailable in the app language", async () => {
    const calls = await openSheet({
      [`GET ${RULES}`]: rules("coach-data-rules-v1", false, null),
    });
    expect(await screen.findByTestId("invite:rules:language")).toBeOnTheScreen();
    expect(screen.getByText(/Approved languages: English, Polski\./)).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("asks again when the version changed (409 stale)", async () => {
    await openSheet({
      [`GET ${RULES}`]: rules("coach-data-rules-v1", false),
      [`POST ${RULES}/acknowledge`]: error(409, "conflict", { document_version: "stale" }),
    });
    await user.press(await screen.findByRole("checkbox"));
    await user.press(screen.getByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByText(/The coach data rules changed\./)).toBeOnTheScreen();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("validates the address, maps the backend's own-address code, and sends once", async () => {
    let answer: (response: Response) => void = () => undefined;
    let reply: Reply = error(422, "validation_error", {
      fields: { email: ["x"] },
      field_codes: { email: ["invalid"] },
    });
    const calls = await openSheet({
      [`GET ${RULES}`]: rules("coach-data-rules-v1", true),
      [`POST ${INVITATIONS}`]: (call) =>
        typeof reply === "function" ? reply(call) : reply.clone(),
      [`GET ${INVITATIONS}`]: invitations([]),
    });
    const email = await screen.findByLabelText("Email");
    await user.type(email, "not-an-address");
    await user.press(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await user.clear(email);
    await user.type(email, "me@example.com");
    await user.press(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText("You can’t invite your own address.")).toBeOnTheScreen();

    reply = () => new Promise<Response>((resolve) => (answer = resolve));
    await user.clear(email);
    await user.type(email, "fighter@example.com");
    await user.press(screen.getByRole("button", { name: "Send invitation" }));
    const sending = await screen.findByRole("button", { name: "Sending…" });
    expect(sending).toBeDisabled();
    fireEvent.press(sending);
    await act(async () =>
      answer(jsonResponse({ invitation: invitation("inv-f", "pending") }, { status: 201 })),
    );
    expect(await screen.findByText("Invitation pending")).toBeOnTheScreen();
    expect(screen.queryByText(/Already invited|emailing|sent to/i)).toBeNull();
    const posts = calls.filter((call) => call.method === "POST" && call.path === INVITATIONS);
    // The malformed address never left the device; the double press sent nothing more.
    expect(posts).toHaveLength(2);
    expect(posts[1]?.body).toEqual({ email: "fighter@example.com" });
  });

  it("returns to the data rules when the backend says they are required", async () => {
    let rulesCalls = 0;
    await openSheet({
      [`GET ${RULES}`]: () => {
        rulesCalls += 1;
        return rules("coach-data-rules-v2", rulesCalls === 1);
      },
      [`POST ${INVITATIONS}`]: error(409, "conflict", { data_rules_acknowledgement: "required" }),
      [`GET ${INVITATIONS}`]: invitations([]),
    });
    await user.type(await screen.findByLabelText("Email"), "fighter@example.com");
    await user.press(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByTestId("invite:rules")).toBeOnTheScreen();
    expect(screen.getByRole("checkbox", { name: /coach-data-rules-v2/ })).not.toBeChecked();
  });
});

describe("Fighter (C04)", () => {
  it("shows only the disclosed fields, Not shared for the rest, and never C3/C4 data", async () => {
    backend({ [`GET ${FIGHTERS}/rel-1`]: jsonResponse({ relationship: ALEX }) });
    await renderWithProviders(<CoachFighterScreen relationshipId="rel-1" />);
    expect(await screen.findByRole("header", { name: "Alex Kowal" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Stance: Southpaw")).toBeOnTheScreen();
    expect(screen.getByLabelText("Experience level: Not shared")).toBeOnTheScreen();
    expect(screen.getByLabelText("Amateur bouts: Not shared")).toBeOnTheScreen();
    expect(screen.queryByText(/private\.example|2001|71\.5|canary goal/)).toBeNull();
  });

  it("shows one not-available state for an ended, foreign or unknown relationship", async () => {
    const calls = backend({ [`GET ${FIGHTERS}/rel-x`]: error(404, "not_found") });
    await renderWithProviders(<CoachFighterScreen relationshipId="rel-x" />);
    expect(await screen.findByTestId("coach-fighter:unavailable")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "End relationship" })).toBeNull();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("ends only after confirmation and the backend's 204, dropping the private detail", async () => {
    const calls = backend({
      [`GET ${FIGHTERS}/rel-1`]: jsonResponse({ relationship: ALEX }),
      [`POST ${FIGHTERS}/rel-1/end`]: new Response(null, { status: 204 }),
    });
    const { queryClient } = await renderWithProviders(
      <CoachFighterScreen relationshipId="rel-1" />,
    );
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    expect(await screen.findByText("End your relationship with Alex Kowal?")).toBeOnTheScreen();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    const confirm = screen.getAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(
      await screen.findByText("Your relationship with Alex Kowal has ended."),
    ).toBeOnTheScreen();
    expect(calls.filter((call) => call.method === "POST").map((call) => call.path)).toEqual([
      `${FIGHTERS}/rel-1/end`,
    ]);
    expect(queryClient.getQueryData(coachFighterKey("rel-1"))).toBeUndefined();
  });

  it("never reports an end the backend did not confirm (404)", async () => {
    backend({
      [`GET ${FIGHTERS}/rel-1`]: jsonResponse({ relationship: ALEX }),
      [`POST ${FIGHTERS}/rel-1/end`]: error(404, "not_found"),
    });
    const { queryClient } = await renderWithProviders(
      <CoachFighterScreen relationshipId="rel-1" />,
    );
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    const confirm = await screen.findAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);
    expect(
      await screen.findByText(
        "This relationship is no longer available. Your fighters list is up to date.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/has ended/)).toBeNull();
    expect(queryClient.getQueryData(coachFighterKey("rel-1"))).toBeUndefined();
  });

  it("keeps the relationship on a failure", async () => {
    backend({
      [`GET ${FIGHTERS}/rel-1`]: jsonResponse({ relationship: ALEX }),
      [`POST ${FIGHTERS}/rel-1/end`]: error(500, "internal_error"),
    });
    await renderWithProviders(<CoachFighterScreen relationshipId="rel-1" />);
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    const confirm = await screen.findAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);
    const alert = await screen.findByText(
      "We couldn’t end the relationship. Nothing changed. Try again.",
    );
    expect(alert).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.queryByText(/has ended/)).toBeNull();
  });
});
