import { focusManager } from "@tanstack/react-query";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import type React from "react";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { GymOnboardingScreen } from "./gym-onboarding-screen";

/*
 * The Gym owner mobile registration (SF-87, OG1 → OG2 → OG3 → OG6b) on the
 * SF-83 / SF-84 / SF-85 APIs, with the network mocked at `fetch` by a fake
 * backend that applies their rules (durable create keys, the one open draft,
 * required and stale revisions, completion requirements). These check what
 * is sent, what is shown and where the flow goes.
 */

const mockParams = {
  current: {} as Record<string, string>,
  listeners: new Set<() => void>(),
  set(next: Record<string, string>) {
    this.current = { ...this.current, ...next };
    this.listeners.forEach((listener) => listener());
  },
};
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => false,
  setParams: (next: Record<string, string>) => mockParams.set(next),
};
const mockRedirects: string[] = [];
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () =>
    jest.requireActual<typeof React>("react").useSyncExternalStore(
      (listener) => {
        mockParams.listeners.add(listener);
        return () => mockParams.listeners.delete(listener);
      },
      () => mockParams.current,
    ),
  Stack: { Screen: () => null },
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: "http://api.test", webUrl: "https://simplefit.test" },
}));

const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };

type Gym = {
  id: string;
  name: string;
  gym_type: string;
  phone: string | null;
  website: string | null;
  tagline: string | null;
  accent_color: string | null;
  location: Record<string, unknown> | null;
  revision: number;
  status: "draft" | "completed";
};

const LOCATION = {
  id: "0b6e1c2d-0000-4000-8000-0000000000aa",
  name: "Warsaw",
  country_code: "PL",
  city: "Warsaw",
  address_line: "ul. Ząbkowska 31",
  entrance_note: null,
  is_primary: true,
};

const json = (status: number, body: unknown) => jsonResponse(body, { status });
const problem = (status: number, code: string, details: Record<string, unknown> = {}) =>
  json(status, { error: { code, message: code, details } });
const validation = (field_codes: Record<string, string[]>) =>
  problem(422, "validation_error", { fields: {}, field_codes });

let sequence = 0;
const newId = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;

/** A fake SF-83 / SF-84 / SF-85 backend. */
function backend(
  initial: Partial<Gym>[] = [],
  options: {
    entryDestination?: string;
    loseCreate?: number;
    /** Holds the next create answer until the returned `release` is called. */
    holdCreate?: { release?: () => void };
  } = {},
) {
  const gyms: Gym[] = initial.map((gym) => ({
    id: newId(),
    name: "Praga Boxing",
    gym_type: "boxing_gym",
    phone: null,
    website: null,
    tagline: null,
    accent_color: null,
    location: null,
    revision: 1,
    status: "draft",
    ...gym,
  }));
  const keys = new Map<string, string>();
  const discarded = new Set<string>();
  let loseCreate = options.loseCreate ?? 0;
  let lastContext: unknown;
  const visible = () => gyms.filter((gym) => !discarded.has(gym.id));
  const view = (gym: Gym) => ({
    setup: {
      gym_id: gym.id,
      name: gym.name,
      gym_type: gym.gym_type,
      phone: gym.phone,
      website: gym.website,
      tagline: gym.tagline,
      accent_color: gym.accent_color,
      primary_location: gym.location,
      revision: gym.revision,
      setup_status: gym.status,
      missing_requirements: gym.status === "completed" || gym.location ? [] : ["primary_location"],
      viewer: { role: "owner", permissions: [], staff_membership_id: "sm-1" },
    },
  });
  const summary = (gym: Gym) => ({
    gym: {
      id: gym.id,
      name: gym.name,
      gym_type: gym.gym_type,
      setup_status: gym.status,
      locations: [],
      inserted_at: "2026-10-27T10:00:00Z",
      updated_at: "2026-10-27T10:00:00Z",
      viewer: { role: "owner", permissions: [], staff_membership_id: "sm-1" },
    },
  });
  const fetchMock = mockFetch(
    jest.fn((url: string, init: RequestInit = {}) => {
      const { pathname } = new URL(url);
      const method = init.method ?? "GET";
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (pathname === "/api/me") return Promise.resolve(jsonResponse({ user: VIEWER }));
      if (pathname === "/api/v1/me/gyms") {
        return Promise.resolve(
          jsonResponse({
            gyms: visible().map((gym) => ({ ...summary(gym).gym })),
            next_cursor: null,
          }),
        );
      }
      if (pathname === "/api/v1/me/entry") {
        return Promise.resolve(
          jsonResponse({
            entry: {
              account_registration: "complete",
              capabilities: [],
              coach_profile: "not_started",
              fighter_profile:
                options.entryDestination === "fighter_home" ? "completed" : "not_started",
              context: null,
              destination: options.entryDestination ?? "gym_onboarding",
              gym_id: null,
              gym_workspace_count: 0,
              gym_workspaces: [],
              intent: null,
              mandatory: false,
              reason: "fixture",
            },
          }),
        );
      }
      if (pathname === "/api/v1/me/entry/context" && method === "PUT") {
        lastContext = body;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (pathname === "/api/v1/gyms" && method === "POST") {
        const key = String(body.client_request_id);
        const replay = keys.get(key);
        if (replay !== undefined) {
          if (discarded.has(replay))
            return Promise.resolve(problem(409, "conflict", { client_request_id: "discarded" }));
          return Promise.resolve(jsonResponse(summary(gyms.find((gym) => gym.id === replay)!)));
        }
        const draft = visible().find((gym) => gym.status === "draft");
        if (draft) {
          keys.set(key, draft.id);
          return Promise.resolve(jsonResponse(summary(draft)));
        }
        const gym: Gym = {
          id: newId(),
          name: String(body.name),
          gym_type: String(body.gym_type),
          phone: null,
          website: null,
          tagline: null,
          accent_color: null,
          location: null,
          revision: 1,
          status: "draft",
        };
        gyms.unshift(gym);
        keys.set(key, gym.id);
        if (loseCreate > 0) {
          loseCreate -= 1;
          return Promise.reject(new TypeError("Network request failed"));
        }
        const hold = options.holdCreate;
        if (hold && hold.release === undefined) {
          return new Promise<Response>((resolve) => {
            hold.release = () => resolve(json(201, summary(gym)));
          });
        }
        return Promise.resolve(json(201, summary(gym)));
      }
      const match = /^\/api\/v1\/gyms\/([^/]+)(\/.*)?$/.exec(pathname);
      const gym = visible().find((candidate) => candidate.id === match?.[1]);
      if (!gym) return Promise.resolve(problem(404, "not_found"));
      const rest = match?.[2] ?? "";
      if (rest === "/setup" && method === "GET") return Promise.resolve(jsonResponse(view(gym)));
      if (rest === "/setup" || rest === "/setup/primary-location") {
        if (body.expected_revision === undefined)
          return Promise.resolve(validation({ expected_revision: ["required"] }));
        if (body.expected_revision !== gym.revision)
          return Promise.resolve(problem(409, "conflict", { revision: "stale" }));
        const { expected_revision: _revision, ...fields } = body;
        if (rest === "/setup") Object.assign(gym, fields);
        else gym.location = { ...LOCATION, ...fields, name: fields.city };
        gym.revision += 1;
        return Promise.resolve(jsonResponse(view(gym)));
      }
      if (rest === "/complete-setup" && method === "POST") {
        if (gym.location === null)
          return Promise.resolve(validation({ primary_location: ["required"] }));
        gym.status = "completed";
        return Promise.resolve(jsonResponse(view(gym)));
      }
      throw new Error(`unexpected request ${method} ${pathname}`);
    }),
  );
  const calls = () =>
    (fetchMock.mock.calls as [string, RequestInit?][]).map(([url, init]) => ({
      call: `${init?.method ?? "GET"} ${new URL(url).pathname}`,
      body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    }));
  return {
    gyms: () => visible(),
    calls,
    writes: () => calls().filter(({ call }) => !call.startsWith("GET ")),
    lastContext: () => lastContext,
    editElsewhere: (id: string, fields: Partial<Gym>) => {
      const gym = gyms.find((candidate) => candidate.id === id)!;
      Object.assign(gym, fields);
      gym.revision += 1;
    },
    discard: (id: string) => discarded.add(id),
  };
}

const user = userEvent.setup();
const heading = (name: string | RegExp) => screen.findByRole("header", { name });
const press = (name: string | RegExp) => user.press(screen.getByRole("button", { name }));
const chooseCountry = async (search: string, name: string) => {
  await press("Country");
  await user.type(screen.getByLabelText("Search countries"), search);
  await user.press(await screen.findByRole("radio", { name }));
};
async function fillOg1(name = "Praga Boxing Club") {
  await heading("Gym name & type");
  await user.type(screen.getByLabelText("Gym name"), name);
  await user.press(screen.getByRole("radio", { name: "Boxing club" }));
}

beforeEach(async () => {
  resetSessionForTests();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockParams.current = {};
  mockRedirects.length = 0;
  mockFetch(jest.fn(() => Promise.resolve(jsonResponse({ user: VIEWER }))));
  await completeAuthentication({
    access_token: "sfa_test",
    access_token_expires_at: "2099-01-01T00:00:00Z",
    refresh_token: "sfr_test",
  });
});

describe("Gym owner registration (OG1 → OG6b)", () => {
  it("a new owner: one draft, the location, branding, completion and the gym's home", async () => {
    const api = backend();
    await renderWithProviders(<GymOnboardingScreen />);
    expect(await heading("Gym name & type")).toBeOnTheScreen();
    expect(screen.getByText("Step 1 of 3 · Gym name & type")).toBeOnTheScreen();
    expect(screen.getByLabelText("Step 1 of 3")).toHaveAccessibilityValue({
      min: 1,
      max: 3,
      now: 1,
    });
    // Reading creates nothing; no FUTURE step, plan or trial is offered.
    expect(api.writes()).toEqual([]);
    expect(screen.queryByText(/trial|Plan|verified|sfit\.box/i)).toBeNull();

    await fillOg1();
    await user.type(screen.getByLabelText("Website · optional"), "praga.pl");
    await press("Continue");
    expect(await heading("Location")).toBeOnTheScreen();
    const [created, extra] = api.writes();
    expect(created?.call).toBe("POST /api/v1/gyms");
    expect(created?.body).toMatchObject({ name: "Praga Boxing Club", gym_type: "boxing_club" });
    expect((created?.body as { client_request_id: string }).client_request_id).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(extra?.body).toEqual({ website: "https://praga.pl", expected_revision: 1 });

    await chooseCountry("Pol", "Poland");
    await user.type(screen.getByLabelText("City"), "Warsaw");
    await user.type(screen.getByLabelText("Address"), "ul. Ząbkowska 31");
    await press("Continue");
    expect(await heading("Branding")).toBeOnTheScreen();
    expect(api.writes().at(-1)).toEqual({
      call: `PUT /api/v1/gyms/${api.gyms()[0]?.id}/setup/primary-location`,
      body: {
        country_code: "PL",
        city: "Warsaw",
        address_line: "ul. Ząbkowska 31",
        entrance_note: null,
        expected_revision: 2,
      },
    });

    // Logo and Cover are not available yet: no upload, nothing saved.
    expect(
      screen.getByLabelText("Logo upload isn’t available yet. Your initials are used."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Cover photo upload isn’t available yet.")).toBeOnTheScreen();
    await user.press(screen.getByRole("radio", { name: "Sky" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Sky" })).toBeChecked());
    await press("Create gym");
    expect(await heading("Praga Boxing Club is created.")).toBeOnTheScreen();
    const writes = api.writes().map(({ call, body }) => ({ call, body }));
    expect(writes.at(-2)).toEqual({
      call: `PATCH /api/v1/gyms/${api.gyms()[0]?.id}/setup`,
      body: { accent_color: "#7fa7c9", expected_revision: 3 },
    });
    expect(writes.at(-1)?.call).toBe(`POST /api/v1/gyms/${api.gyms()[0]?.id}/complete-setup`);
    expect(api.gyms()[0]?.status).toBe("completed");

    await press("Go to gym");
    await waitFor(() =>
      expect(api.lastContext()).toEqual({ context: "gym", gym_id: api.gyms()[0]?.id }),
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/?intent=gym"));
  });

  it("checks OG1's requirements before anything is sent", async () => {
    const api = backend();
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Gym name & type");
    await user.type(screen.getByLabelText("Phone · optional"), "call me");
    await press("Continue");
    expect(await screen.findByText("Enter your gym’s name.")).toBeOnTheScreen();
    expect(screen.getByText("Choose a gym type.")).toBeOnTheScreen();
    expect(screen.getByText("This doesn’t look right. Check the format.")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);
  });

  it("a double tap creates once", async () => {
    const hold: { release?: () => void } = {};
    const api = backend([], { holdCreate: hold });
    await renderWithProviders(<GymOnboardingScreen />);
    await fillOg1();
    // The second tap lands while the first create is still on its way.
    await press("Continue");
    await press("Continue");
    await waitFor(() => expect(hold.release).toBeDefined());
    await act(async () => hold.release?.());
    expect(await heading("Location")).toBeOnTheScreen();
    expect(api.writes().filter(({ call }) => call === "POST /api/v1/gyms")).toHaveLength(1);
    expect(api.gyms()).toHaveLength(1);
  });

  it("a lost create answer claims nothing; Retry repeats the key and one gym exists", async () => {
    const api = backend([], { loseCreate: 1 });
    await renderWithProviders(<GymOnboardingScreen />);
    await fillOg1();
    await press("Continue");
    expect(await screen.findByText(/We couldn’t confirm your gym was created\./)).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Praga Boxing Club")).toBeOnTheScreen();
    await press("Retry");
    expect(await heading("Location")).toBeOnTheScreen();
    const keys = api
      .writes()
      .filter(({ call }) => call === "POST /api/v1/gyms")
      .map(({ body }) => (body as { client_request_id: string }).client_request_id);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(api.gyms()).toHaveLength(1);
  });

  it("a key whose draft was discarded is refused truthfully; only a new Continue creates", async () => {
    const api = backend([], { loseCreate: 1 });
    await renderWithProviders(<GymOnboardingScreen />);
    await fillOg1();
    await press("Continue");
    await screen.findByText(/We couldn’t confirm your gym was created\./);
    api.discard(api.gyms()[0]!.id);
    await press("Retry");
    expect(await screen.findByText(/That gym draft was discarded\./)).toBeOnTheScreen();
    expect(api.gyms()).toHaveLength(0);
    await press("Continue");
    expect(await heading("Location")).toBeOnTheScreen();
    const keys = api
      .writes()
      .filter(({ call }) => call === "POST /api/v1/gyms")
      .map(({ body }) => (body as { client_request_id: string }).client_request_id);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(api.gyms()).toHaveLength(1);
  });

  it("resumes a draft from the backend at its first missing step", async () => {
    backend([{ name: "Praga Boxing", phone: "+48 600 000 000" }]);
    await renderWithProviders(<GymOnboardingScreen />);
    expect(await heading("Location")).toBeOnTheScreen();
    await waitFor(() => expect(mockParams.current.step).toBe("location"));
    await press("Back");
    expect(await heading("Gym name & type")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Praga Boxing")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("+48 600 000 000")).toBeOnTheScreen();
  });

  it("Continue on an empty OG2 asks for the location instead of moving on", async () => {
    const api = backend([{ name: "Praga Boxing" }]);
    mockParams.current = { step: "location" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Location");
    await press("Continue");
    expect(await screen.findByText("Choose a country.")).toBeOnTheScreen();
    expect(screen.getByText("Enter the city.")).toBeOnTheScreen();
    expect(screen.getByText("Enter the street address.")).toBeOnTheScreen();
    expect(await heading("Location")).toBeOnTheScreen();
    expect(api.writes()).toEqual([]);
  });

  it("a stale revision writes nothing, keeps the input and saves only on Save my changes", async () => {
    const api = backend([{ name: "Praga Boxing", location: LOCATION, revision: 5 }]);
    mockParams.current = { step: "location" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Location");
    const id = api.gyms()[0]!.id;
    api.editElsewhere(id, { name: "Praga Boxing Club" });
    await user.type(screen.getByLabelText("Entrance note · optional"), "Ring the bell");
    await press("Continue");
    expect(
      await screen.findByText(/This gym changed on another device or tab\./),
    ).toBeOnTheScreen();
    expect(api.gyms()[0]?.location?.entrance_note).toBeNull();
    expect(screen.getByDisplayValue("Ring the bell")).toBeOnTheScreen();
    await press("Save my changes");
    expect(await heading("Branding")).toBeOnTheScreen();
    expect(api.writes().at(-1)?.body).toMatchObject({
      entrance_note: "Ring the bell",
      expected_revision: 6,
    });
  });

  it("Skip completes without the branding edits", async () => {
    const api = backend([{ name: "Praga Boxing", location: LOCATION }]);
    mockParams.current = { step: "branding" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Branding");
    await user.type(screen.getByLabelText("Tagline · optional"), "Not saved");
    await press("Skip for now");
    expect(await heading("Praga Boxing is created.")).toBeOnTheScreen();
    expect(api.writes().map(({ call }) => call)).toEqual([
      `POST /api/v1/gyms/${api.gyms()[0]?.id}/complete-setup`,
    ]);
    expect(api.gyms()[0]?.tagline).toBeNull();
  });

  it("completion without a location says so, with a way to OG2", async () => {
    backend([{ name: "Praga Boxing" }]);
    mockParams.current = { step: "branding" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Branding");
    await press("Create gym");
    expect(await screen.findByText(/Your gym is missing details\./)).toBeOnTheScreen();
    await press("Go to Location");
    expect(await heading("Location")).toBeOnTheScreen();
  });

  it("a draft completed on another device leaves through the entry on the foreground", async () => {
    const api = backend([{ name: "Praga Boxing", location: LOCATION }]);
    mockParams.current = { step: "branding" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Branding");
    api.editElsewhere(api.gyms()[0]!.id, { status: "completed" });
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(mockRedirects).toContain("/?intent=gym"));
  });

  it("an owner of a completed gym is told a new one is another, separate gym", async () => {
    backend([{ name: "First Gym", status: "completed", location: LOCATION }]);
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Gym name & type");
    expect(screen.getByText(/You already have a gym in SimpleFit\./)).toBeOnTheScreen();
    expect(screen.getByLabelText("Gym name")).toHaveDisplayValue("");
  });

  it("Save & exit with only a draft saves, then opens Settings (no loop back to setup)", async () => {
    const api = backend([{ name: "Praga Boxing" }]);
    mockParams.current = { step: "type" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Gym name & type");
    await user.clear(screen.getByLabelText("Gym name"));
    await user.type(screen.getByLabelText("Gym name"), "Praga Boxing Club");
    await press("Save & exit");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/settings"));
    expect(api.gyms()[0]?.name).toBe("Praga Boxing Club");
    expect(api.gyms()[0]?.status).toBe("draft");
  });

  it("Save & exit returns to another context through the entry", async () => {
    backend([{ name: "Praga Boxing" }], { entryDestination: "fighter_home" });
    mockParams.current = { step: "type" };
    await renderWithProviders(<GymOnboardingScreen />);
    await heading("Gym name & type");
    await press("Save & exit");
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/home"));
  });
});
