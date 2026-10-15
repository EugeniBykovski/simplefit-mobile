import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { myCoachKey } from "@/entities/coach-relationship";
import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { CoachRelationshipScreen } from "./coach-relationship-screen";
import { MyCoachesScreen } from "./my-coaches-screen";

/*
 * FC1 My coaches and FC2 Coach relationship (SF-59) on the SF-56 fighter
 * endpoints, with the network mocked at `fetch`. Only what the backend
 * returns is shown, unavailable (404) is never an empty list, and a
 * relationship is reported ended only on the backend's 204.
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
const COACHES = "/api/v1/me/coaches";

const active = (id: string, display: string | null, brand: string | null, extra = {}) => ({
  relationship_id: id,
  status: "active",
  started_at: "2026-09-01T10:00:00Z",
  ended_at: null,
  ended_by: null,
  disclosure_version: "test-disclosure",
  disclosed_fields: ["display_name", "username", "stance"],
  coach: {
    display_name: display,
    brand_name: brand,
    // Privacy canaries: never part of the DTO; must never render even if sent.
    email: "coach@private.example",
    phone: "+48 600 000 000",
  },
  coach_display_name_at_end: null,
  ...extra,
});
const MAREK = active("rel-1", "Coach Marek", "Marek Boxing");
const ALEX = active("rel-2", "Alex Novak", null);
const ENDED = {
  ...active("rel-9", null, null),
  status: "ended",
  ended_at: "2026-10-02T10:00:00Z",
  ended_by: "fighter",
  disclosed_fields: [],
  coach: null,
  coach_display_name_at_end: "Sam R.",
};

type Call = { method: string; path: string; query: URLSearchParams };
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
const error = (status: number, code: string) =>
  jsonResponse(
    { error: { code, message: "English text clients never show", details: {}, request_id: "r" } },
    { status },
  );
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

describe("My coaches (FC1)", () => {
  it("lists the active coaches the backend returns, with their public identity only", async () => {
    const calls = backend({ [`GET ${COACHES}`]: byStatus({ active: [MAREK, ALEX] }) });
    await renderWithProviders(<MyCoachesScreen view="active" />);

    const marek = await screen.findByRole("button", { name: /^Coach Marek, Marek Boxing · since/ });
    expect(screen.getByRole("button", { name: /^Alex Novak, Since/ })).toBeOnTheScreen();
    expect(screen.queryByText(/coach@private|600 000/)).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Coaches" });

    await user.press(marek);
    expect(mockRouter.push).toHaveBeenCalledWith("/profile/coaches/rel-1");
    const read = calls.find((call) => call.path === COACHES);
    expect(read?.query.get("status")).toBe("active");
  });

  it("tells an empty list apart from coaches being unavailable", async () => {
    backend({ [`GET ${COACHES}`]: page([]) });
    const first = await renderWithProviders(<MyCoachesScreen view="active" />);
    expect(await screen.findByText("No coaches yet")).toBeOnTheScreen();
    expect(screen.queryByText("Coaches aren’t available")).toBeNull();
    await first.unmount();

    backend({ [`GET ${COACHES}`]: error(404, "not_found") });
    await renderWithProviders(<MyCoachesScreen view="active" />);
    expect(await screen.findByText("Coaches aren’t available")).toBeOnTheScreen();
    expect(screen.queryByText("No coaches yet")).toBeNull();
  });

  it("never shows 'No coaches' when the request failed, and retries", async () => {
    let fail = true;
    backend({
      [`GET ${COACHES}`]: (call) =>
        fail ? error(500, "internal_error") : byStatus({ active: [MAREK] })(call),
    });
    await renderWithProviders(<MyCoachesScreen view="active" />);
    expect(await screen.findByText(/We couldn’t load your coaches\./)).toBeOnTheScreen();
    expect(screen.queryByText("No coaches yet")).toBeNull();
    fail = false;
    await user.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Coach Marek")).toBeOnTheScreen();
  });

  it("lists ended relationships with the name at the end only, and opens none", async () => {
    const calls = backend({ [`GET ${COACHES}`]: byStatus({ ended: [ENDED] }) });
    await renderWithProviders(<MyCoachesScreen view="ended" />);
    expect(await screen.findByLabelText(/^Sam R\., Ended .* · by you$/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Sam R\./ })).toBeNull();
    expect(calls.find((call) => call.path === COACHES)?.query.get("status")).toBe("ended");

    await user.press(screen.getByRole("tab", { name: "Active" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/profile/coaches");
  });

  it("pages with the backend cursor", async () => {
    const calls = backend({
      [`GET ${COACHES}`]: ({ query }) =>
        query.get("cursor") === "c2" ? page([ALEX]) : page([MAREK], "c2"),
    });
    await renderWithProviders(<MyCoachesScreen view="active" />);
    await user.press(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Alex Novak")).toBeOnTheScreen();
    expect(screen.getByText("Coach Marek")).toBeOnTheScreen();
    expect(
      calls.filter((call) => call.path === COACHES).map((call) => call.query.get("cursor")),
    ).toEqual([null, "c2"]);
  });
});

describe("Coach relationship (FC2)", () => {
  it("shows one active relationship found in the fighter's own list", async () => {
    const calls = backend({ [`GET ${COACHES}`]: byStatus({ active: [ALEX, MAREK] }) });
    await renderWithProviders(<CoachRelationshipScreen relationshipId="rel-1" />);

    expect(await screen.findByRole("header", { name: "Coach Marek" })).toBeOnTheScreen();
    expect(screen.getByText("Marek Boxing")).toBeOnTheScreen();
    expect(screen.getByText("What Coach Marek sees")).toBeOnTheScreen();
    for (const label of ["Display name", "Username", "Stance"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.queryByText("City")).toBeNull();
    expect(screen.getByText("Weight, height, goals and next fight")).toBeOnTheScreen();
    expect(screen.queryByText(/coach@private|600 000/)).toBeNull();
    // Only the fighter's own list is read: no coach profile, no other endpoint.
    expect(calls.every((call) => call.path === COACHES || call.path === "/api/me")).toBe(true);
    expect(calls.find((call) => call.path === COACHES)?.query.get("status")).toBe("active");
  });

  it("finds a relationship on a later page", async () => {
    backend({
      [`GET ${COACHES}`]: ({ query }) =>
        query.get("cursor") === "c2" ? page([MAREK]) : page([ALEX], "c2"),
    });
    await renderWithProviders(<CoachRelationshipScreen relationshipId="rel-1" />);
    expect(await screen.findByRole("header", { name: "Coach Marek" })).toBeOnTheScreen();
  });

  it.each([
    ["an ended relationship", { active: [ALEX], ended: [ENDED] }, "rel-9"],
    ["someone else's or an unknown id", { active: [ALEX] }, "rel-foreign"],
  ])("shows one not-available state for %s", async (_case, lists, id) => {
    const calls = backend({ [`GET ${COACHES}`]: byStatus(lists) });
    await renderWithProviders(<CoachRelationshipScreen relationshipId={id} />);
    expect(await screen.findByText("This coach isn’t available")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "End relationship" })).toBeNull();
    expect(calls.some((call) => call.method !== "GET")).toBe(false);
  });

  it("ends only after confirmation and the backend's 204, leaving other coaches untouched", async () => {
    let ended = false;
    const calls = backend({
      [`GET ${COACHES}`]: () => page(ended ? [ALEX] : [MAREK, ALEX]),
      [`POST ${COACHES}/rel-1/end`]: () => {
        ended = true;
        return new Response(null, { status: 204 });
      },
    });
    const { queryClient } = await renderWithProviders(
      <CoachRelationshipScreen relationshipId="rel-1" />,
    );
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    expect(await screen.findByText("End your relationship with Coach Marek?")).toBeOnTheScreen();
    await user.press(screen.getAllByRole("button", { name: "Keep" })[1]!);
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await user.press(screen.getByRole("button", { name: "End relationship" }));
    const confirm = await screen.findAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await screen.findByText("Coach Marek no longer sees your profile.")).toBeOnTheScreen();
    expect(calls.filter((call) => call.method === "POST").map((call) => call.path)).toEqual([
      `${COACHES}/rel-1/end`,
    ]);
    expect(queryClient.getQueryData(myCoachKey("rel-1"))).toBeUndefined();
  });

  it("never reports an end the backend did not confirm (404)", async () => {
    backend({
      [`GET ${COACHES}`]: page([MAREK]),
      [`POST ${COACHES}/rel-1/end`]: error(404, "not_found"),
    });
    const { queryClient } = await renderWithProviders(
      <CoachRelationshipScreen relationshipId="rel-1" />,
    );
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    const confirm = await screen.findAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);

    expect(
      await screen.findByText(
        "This relationship is no longer available. Your coaches list is up to date.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/no longer sees your profile/)).toBeNull();
    expect(queryClient.getQueryData(myCoachKey("rel-1"))).toBeUndefined();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("keeps the relationship on a failure and sends one request at a time", async () => {
    let answer: (response: Response) => void = () => undefined;
    const calls = backend({
      [`GET ${COACHES}`]: page([MAREK]),
      [`POST ${COACHES}/rel-1/end`]: () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    await renderWithProviders(<CoachRelationshipScreen relationshipId="rel-1" />);
    await user.press(await screen.findByRole("button", { name: "End relationship" }));
    const confirm = await screen.findAllByRole("button", { name: "End relationship" });
    await user.press(confirm[confirm.length - 1]!);
    const pending = await screen.findByRole("button", { name: "Ending…" });
    expect(pending).toBeDisabled();
    await user.press(pending);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);

    await act(async () => answer(error(500, "internal_error")));
    expect(
      await screen.findByText("We couldn’t end the relationship. Nothing changed. Try again."),
    ).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.queryByText(/no longer sees your profile/)).toBeNull();
  });
});
