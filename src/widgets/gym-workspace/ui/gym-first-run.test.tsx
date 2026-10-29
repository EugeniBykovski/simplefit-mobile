import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import type { Gym } from "@/entities/gym";
import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import type { Locale } from "@/shared/i18n/locales";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { GymPulseView } from "./gym-pulse-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/shared/config/env", () => ({ publicEnv: { apiUrl: "http://api.test" } }));

/* GR1 / GR2, the gym owner's mobile first run (SF-92) on G01, against the SF-90 contract. */

const RING = "8d2e4f60-1a2b-4c3d-8e9f-a0b1c2d3e4f5";
const ANNEX = "1c9b7a55-3e2d-4f10-9a8b-7c6d5e4f3a21";
const STARTED = "2026-10-28T09:00:00Z";

const OWNER = ["view_workspace", "edit_gym", "complete_setup", "manage_first_run"] as const;

const gym = (
  id = RING,
  role: Gym["viewer"]["role"] = "owner",
  permissions: readonly string[] = OWNER,
): Gym => ({
  id,
  name: id === RING ? "Ring A Boxing" : "Annex Club",
  gym_type: "boxing_club",
  setup_status: "completed",
  inserted_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
  locations: [
    {
      id: "0b6e1c2d-0000-4000-8000-0000000000aa",
      name: "Praga",
      country_code: "PL",
      city: "Warsaw",
      address_line: "ul. Ząbkowska 31",
      entrance_note: null,
      is_primary: true,
    },
  ],
  viewer: {
    role,
    permissions: permissions as Gym["viewer"]["permissions"],
    staff_membership_id: "7a1b2c3d-0000-4000-8000-000000000002",
  },
});

const CHECKLIST = [
  { key: "create_gym", status: "completed" },
  { key: "add_class", status: "coming_later" },
  { key: "invite_staff", status: "coming_later" },
  { key: "invite_members", status: "coming_later" },
  { key: "first_check_in", status: "coming_later" },
];

const firstRun = (status: string, overrides: Record<string, unknown> = {}, gymId = RING) => ({
  first_run: {
    gym_id: gymId,
    status,
    started_at: status === "not_started" ? null : STARTED,
    completed_at: status === "completed" ? STARTED : null,
    dismissed_at: status === "dismissed" ? STARTED : null,
    checklist: CHECKLIST,
    ...overrides,
  },
});

type Answer = { status: number; body?: unknown } | Error;
const ok = (body: unknown): Answer => ({ status: 200, body });
const err = (status: number, code: string, details: Record<string, unknown> = {}): Answer => ({
  status,
  body: { error: { code, message: "x", details } },
});
const offline = () => new TypeError("Network request failed");

/** A fake API: each `METHOD path` answers its queue in order (the last answer repeats). */
function api(routes: Record<string, Answer[]>) {
  const calls: string[] = [];
  mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
      calls.push(key);
      if (key.endsWith("/setup")) return Promise.resolve(jsonResponse({}, { status: 404 }));
      const queue = routes[key];
      if (!queue) return Promise.reject(new Error(`unexpected ${key}`));
      const answer = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(jsonResponse(answer.body ?? {}, { status: answer.status }));
    }),
  );
  return calls;
}

const READ = `GET /api/v1/gyms/${RING}/first-run`;
const START = `POST /api/v1/gyms/${RING}/first-run/start`;
const COMPLETE = `POST /api/v1/gyms/${RING}/first-run/complete`;
const DISMISS = `POST /api/v1/gyms/${RING}/first-run/dismiss`;

type Node = { props: Record<string, unknown>; children: (Node | string)[] };
/** The open overlay (the tour's modal): the visible node with a native close request. */
function openModal(): Node | undefined {
  const walk = (node: Node | string): Node | undefined => {
    if (typeof node === "string") return undefined;
    if (node.props.visible === true && typeof node.props.onRequestClose === "function") return node;
    for (const child of node.children) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  return walk(screen.container as unknown as Node);
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));

async function startTour() {
  await press("Start the tour");
  expect(await screen.findByRole("header", { name: "Your opening checklist" })).toBeOnTheScreen();
}

async function toLastStep() {
  await startTour();
  await press("Next");
  await press("Next");
  await press("Next");
  expect(screen.getByRole("header", { name: "One account, every role" })).toBeOnTheScreen();
}

beforeEach(async () => {
  mockRouter.push.mockClear();
  resetSessionForTests();
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({}))));
  await completeAuthentication({
    access_token: "test-access",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "test-refresh",
  });
});

describe("GR1 · the owner's first run on Gym pulse (SF-92)", () => {
  it("offers the introduction and renders the five checklist items exactly as the API answers", async () => {
    api({ [READ]: [ok(firstRun("not_started"))] });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    expect(await screen.findByRole("header", { name: "Welcome to your gym" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Your gym is ready" })).toBeOnTheScreen();
    for (const item of CHECKLIST) {
      expect(screen.getByTestId(`checklist-${item.key}-${item.status}`)).toBeOnTheScreen();
    }
    // FUTURE items are announced as not available and are not actionable; no counts or percentages.
    const later = screen.getByLabelText("Invite members, With member invitations, Later");
    expect(later.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(
      screen.getByLabelText("Create your gym, Name, type and location saved, Done"),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/%|\d+ (of|steps?)\b/)).toBeNull();
    // GR1 replaces the details and coming-later cards while the first run is offered.
    expect(screen.queryByText("Gym details")).toBeNull();
    expect(screen.queryByText("Coming to your gym")).toBeNull();
  });

  it("keeps the API's order and statuses (an available item, a different order)", async () => {
    const order = [
      { key: "create_gym", status: "completed" },
      { key: "invite_staff", status: "available" },
      { key: "add_class", status: "coming_later" },
      { key: "first_check_in", status: "coming_later" },
      { key: "invite_members", status: "coming_later" },
    ];
    api({ [READ]: [ok(firstRun("not_started", { checklist: order }))] });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByTestId("gym-checklist");
    const rendered = screen.getAllByTestId(/^checklist-/).map((row) => row.props.testID);
    expect(rendered).toEqual(order.map((item) => `checklist-${item.key}-${item.status}`));
    expect(
      screen.getByLabelText("Invite your staff, Send your first staff invitation, Available"),
    ).toBeOnTheScreen();
  });

  it("offers to resume an introduction started on another device, from step 1", async () => {
    api({
      [READ]: [ok(firstRun("in_progress"))],
      [START]: [ok(firstRun("in_progress"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    expect(
      await screen.findByRole("header", { name: "Pick up the introduction" }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/You started it on Oct 28/)).toBeOnTheScreen();
    await press("Resume tour");
    expect(await screen.findByText("Tour · 1 of 4")).toBeOnTheScreen();
  });

  it.each(["completed", "dismissed"])(
    "never reopens a %s introduction: G01 with its details",
    async (status) => {
      api({ [READ]: [ok(firstRun(status))] });
      await renderWithProviders(<GymPulseView gym={gym()} />);
      expect(await screen.findByText("Gym details")).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByText("Coming to your gym")).toBeOnTheScreen());
      expect(screen.queryByTestId(/^first-run-/)).toBeNull();
      expect(screen.queryByTestId("gym-checklist")).toBeNull();
    },
  );

  it("never asks for the owner's first run without manage_first_run (manager, or an owner projection without it)", async () => {
    const calls = api({});
    await renderWithProviders(<GymPulseView gym={gym(RING, "manager", ["view_workspace"])} />);
    await renderWithProviders(<GymPulseView gym={gym(ANNEX, "owner", ["edit_gym"])} />);
    expect(calls.filter((call) => call.includes("first-run"))).toEqual([]);
    expect(screen.queryByTestId(/^first-run-/)).toBeNull();
  });

  it("keeps G01 on a 403 (the backend refuses the role)", async () => {
    api({ [READ]: [err(403, "forbidden")] });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    expect(await screen.findByText("Gym details")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^first-run-/)).toBeNull();
  });

  it("works without the first run when its read fails, and retries", async () => {
    api({ [READ]: [err(500, "internal"), ok(firstRun("not_started"))] });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    expect(await screen.findByText(/We couldn’t load your introduction/)).toBeOnTheScreen();
    expect(screen.getAllByText("Ring A Boxing").length).toBeGreaterThan(0);
    await press("Try again");
    expect(await screen.findByRole("header", { name: "Welcome to your gym" })).toBeOnTheScreen();
  });

  it("says it is offline when there is no network, never an empty checklist", async () => {
    api({ [READ]: [offline()] });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    expect(await screen.findByText(/You’re offline/)).toBeOnTheScreen();
    expect(screen.queryByTestId("gym-checklist")).toBeNull();
  });

  it("starts only on the backend's answer; a failed start stays with a retry", async () => {
    const calls = api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [err(503, "unavailable"), ok(firstRun("in_progress"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByText("Start the tour");
    await press("Start the tour");
    expect(await screen.findByText("We couldn’t save that. Nothing changed.")).toBeOnTheScreen();
    expect(screen.queryByText("Tour · 1 of 4")).toBeNull();
    await press("Try again");
    expect(await screen.findByText("Tour · 1 of 4")).toBeOnTheScreen();
    expect(calls.filter((call) => call === START)).toHaveLength(2);
  });

  it("asks before skipping; Skip introduction records dismissed and completes nothing", async () => {
    const calls = api({
      [READ]: [ok(firstRun("not_started"))],
      [DISMISS]: [err(500, "internal"), ok(firstRun("dismissed"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await press("Skip");
    expect(screen.getByRole("header", { name: "Skip the introduction?" })).toBeOnTheScreen();
    await press("Keep it");
    expect(calls).not.toContain(DISMISS);
    await press("Skip");
    await press("Skip introduction");
    expect(
      await screen.findByText(/We couldn’t save that. Nothing changed. Try again./),
    ).toBeOnTheScreen();
    await press("Skip introduction");
    expect(await screen.findByText(/Introduction skipped\./)).toBeOnTheScreen();
    // The checklist is the backend's: unchanged.
    expect(screen.getByTestId("checklist-add_class-coming_later")).toBeOnTheScreen();
  });

  it("shows the outcome kept on another device when starting conflicts (409)", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), ok(firstRun("completed"))],
      [START]: [err(409, "conflict", { first_run: "completed" })],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByText("Start the tour");
    await press("Start the tour");
    expect(await screen.findByText(/Introduction finished\./)).toBeOnTheScreen();
    expect(screen.queryByText("Tour · 1 of 4")).toBeNull();
  });
});

describe("GR2 · the native tour (SF-92)", () => {
  it("walks the four MVP steps with Back and Next, records nothing until Finish, then the complete card", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const calls = api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [ok(firstRun("in_progress"))],
      [COMPLETE]: [ok(firstRun("completed"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining("Tour · 1 of 4. Your opening checklist."),
    );
    await press("Next");
    expect(screen.getByText(/Name, type and location come straight/)).toBeOnTheScreen();
    await press("Back");
    expect(screen.getByRole("header", { name: "Your opening checklist" })).toBeOnTheScreen();
    await press("Next");
    await press("Next");
    expect(screen.getByRole("header", { name: "Tools arrive in these tabs" })).toBeOnTheScreen();
    await press("Next");
    expect(screen.getByText(/You own Ring A Boxing/)).toBeOnTheScreen();
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([START]);
    // No FUTURE step is reachable: Finish is the fourth step's action.
    await press("Finish");
    expect(
      await screen.findByRole("header", { name: "You know your way around" }),
    ).toBeOnTheScreen();
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([START, COMPLETE]);
    await press("Back to Gym pulse");
    expect(screen.queryByText("You know your way around")).toBeNull();
    expect(screen.getByText(/Introduction finished\./)).toBeOnTheScreen();
  });

  it("keeps step 4 with Try again when finishing fails, then finishes", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), ok(firstRun("in_progress"))],
      [START]: [ok(firstRun("in_progress"))],
      [COMPLETE]: [err(500, "internal"), ok(firstRun("completed"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await toLastStep();
    await press("Finish");
    expect(await screen.findByRole("header", { name: "We couldn’t save that" })).toBeOnTheScreen();
    expect(screen.getByText("Couldn’t reach SimpleFit. Nothing changed.")).toBeOnTheScreen();
    await press("Try again");
    expect(
      await screen.findByRole("header", { name: "You know your way around" }),
    ).toBeOnTheScreen();
  });

  it("reconciles a lost answer with the backend: completed only when the re-read says so", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), ok(firstRun("completed"))],
      [START]: [ok(firstRun("in_progress"))],
      [COMPLETE]: [offline()],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await toLastStep();
    await press("Finish");
    expect(
      await screen.findByRole("header", { name: "You know your way around" }),
    ).toBeOnTheScreen();
  });

  it("never claims success when the answer is lost and the re-read fails too", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), offline()],
      [START]: [ok(firstRun("in_progress"))],
      [COMPLETE]: [offline()],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await toLastStep();
    await press("Finish");
    expect(await screen.findByRole("header", { name: "We couldn’t save that" })).toBeOnTheScreen();
    expect(screen.queryByText("You know your way around")).toBeNull();
  });

  it("closes on the outcome another device kept when finishing conflicts (409)", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), ok(firstRun("dismissed"))],
      [START]: [ok(firstRun("in_progress"))],
      [COMPLETE]: [err(409, "conflict", { first_run: "dismissed" })],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await toLastStep();
    await press("Finish");
    expect(await screen.findByText(/Introduction skipped\./)).toBeOnTheScreen();
    expect(screen.queryByText("Tour · 4 of 4")).toBeNull();
  });

  it("asks before ending; End introduction records dismissed; Keep going returns to the step", async () => {
    const calls = api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [ok(firstRun("in_progress"))],
      [DISMISS]: [ok(firstRun("dismissed"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    await press("Next");
    await press("End tour");
    expect(screen.getByRole("header", { name: "End the introduction?" })).toBeOnTheScreen();
    await press("Keep going");
    expect(screen.getByText(/Name, type and location come straight/)).toBeOnTheScreen();
    await press("End tour");
    await press("End introduction");
    expect(await screen.findByText(/Introduction skipped\./)).toBeOnTheScreen();
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([START, DISMISS]);
  });

  it("Android Back goes back a step, asks on step 1, keeps going from the confirmation; never records", async () => {
    const calls = api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [ok(firstRun("in_progress"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    const back = async () => {
      await act(async () => {
        (openModal()?.props.onRequestClose as () => void)();
      });
    };
    await press("Next");
    await back();
    expect(screen.getByRole("header", { name: "Your opening checklist" })).toBeOnTheScreen();
    await back();
    expect(screen.getByRole("header", { name: "End the introduction?" })).toBeOnTheScreen();
    await back();
    expect(screen.getByRole("header", { name: "Your opening checklist" })).toBeOnTheScreen();
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([START]);
  });

  it("without a measurable target the card stays readable, with no ring or arrow (fallback)", async () => {
    api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [ok(firstRun("in_progress"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    expect(openModal()).toBeDefined();
    expect(screen.getByRole("button", { name: "Next" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "End tour" })).toBeOnTheScreen();
  });

  it("closes when another device ends it while the tour is open (back in the foreground)", async () => {
    api({
      [READ]: [ok(firstRun("not_started")), ok(firstRun("completed"))],
      [START]: [ok(firstRun("in_progress"))],
    });
    await renderWithProviders(<GymPulseView gym={gym()} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await screen.findByText(/Introduction finished\./)).toBeOnTheScreen();
    expect(screen.queryByText("Tour · 1 of 4")).toBeNull();
    focusManager.setFocused(undefined);
  });

  it("keeps Gym A and Gym B apart: another gym's view starts without the open tour", async () => {
    api({
      [READ]: [ok(firstRun("not_started"))],
      [START]: [ok(firstRun("in_progress"))],
      [`GET /api/v1/gyms/${ANNEX}/first-run`]: [ok(firstRun("dismissed", {}, ANNEX))],
    });
    const view = await renderWithProviders(<GymPulseView key={RING} gym={gym(RING)} />);
    await screen.findByRole("header", { name: "Welcome to your gym" });
    await startTour();
    await act(async () => {
      view.rerender(<GymPulseView key={ANNEX} gym={gym(ANNEX)} />);
    });
    expect(screen.queryByText("Tour · 1 of 4")).toBeNull();
    expect(await screen.findByText("Gym details")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^first-run-/)).toBeNull();
  });

  it.each<Locale>(["en", "ru", "pl", "de", "uk", "es", "es-MX", "fr"])(
    "renders GR1 and a GR2 step in %s without a raw message key",
    async (locale) => {
      api({
        [READ]: [ok(firstRun("not_started"))],
        [START]: [ok(firstRun("in_progress"))],
      });
      await renderWithProviders(<GymPulseView gym={gym()} />, { storedLocale: locale });
      await screen.findByTestId("gym-checklist");
      expect(screen.queryAllByText(/\bgymShell\./)).toEqual([]);
      expect(screen.queryAllByLabelText(/\bgymShell\./)).toEqual([]);
      await fireEvent.press(screen.getByTestId("first-run-start"));
      await waitFor(() => expect(openModal()).toBeDefined());
      expect(screen.queryAllByText(/\bgymShell\./)).toEqual([]);
    },
  );
});
