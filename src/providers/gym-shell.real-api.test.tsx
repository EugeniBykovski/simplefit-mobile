import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { request } from "node:http";
import { join, resolve } from "node:path";

import { focusManager } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  type MockContextConfig,
} from "expo-router/testing-library";

import { callWithSession, completeAuthentication, signOut } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import {
  completeGymSetup,
  createGym,
  getGymSetup,
  setGymPrimaryLocation,
} from "@/shared/api/generated/endpoints/gyms/gyms";

import type { EntryResponseEntry as Entry } from "@/shared/api/generated/model";

import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

/*
 * SF-89 against the real SF-83/SF-84/SF-85 API and PostgreSQL (scenarios
 * A–S of the ticket): the production Expo Router tree, gates, session layer
 * and generated client, nothing mocked but the transport (`fetch` over
 * node:http to the disposable API) and reduced motion.
 *
 * Accounts are registered through the API's own email registration (the
 * emailed code read with `mix e2e.email_code`) and completed through the
 * account, Fighter and Coach profile endpoints. Gyms are created and
 * completed through the generated client with the user's session (what the
 * SF-87 screens call), or through plain HTTP as another client (the web)
 * would. Staff memberships, which no endpoint creates before SF-92, are
 * inserted in the disposable database as the domain's own
 * `%Gyms.StaffMembership{}` struct, and ended through
 * `Gyms.revoke_staff_membership/3`. Nothing else is seeded.
 *
 * Skipped unless E2E_REAL_API_URL is set:
 *
 *   E2E_REAL_API_URL       the disposable API (never port 4000)
 *   E2E_API_DATABASE_URL   its database ("e2e" in the name, never simple_fit_dev)
 *   E2E_API_DIR            the simplefit-api checkout (default ../simplefit-api)
 */

const API_URL = process.env.E2E_REAL_API_URL ?? "";
const DATABASE_URL = process.env.E2E_API_DATABASE_URL ?? "";
const API_DIR = resolve(process.env.E2E_API_DIR ?? "../simplefit-api");

jest.mock("@/shared/lib/reduced-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: process.env.E2E_REAL_API_URL ?? "http://unused.invalid" },
}));

const real = API_URL === "" ? describe.skip : describe;

function database(): string {
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (!/e2e/.test(name) || name === "simple_fit_dev") {
    throw new Error("E2E_API_DATABASE_URL must name a disposable end-to-end database");
  }
  if (new URL(API_URL).port === "4000") throw new Error("never the development API on 4000");
  return DATABASE_URL;
}

const sql = (query: string) =>
  execFileSync("psql", [database(), "-Atc", query], { encoding: "utf8" }).trim();

function mixRun(code: string): string {
  // The endpoint serves HTTP only under phx.server: `mix run` binds no port.
  return execFileSync("mix", ["run", "-e", code], {
    cwd: API_DIR,
    env: { ...process.env, MIX_ENV: "dev", DATABASE_URL: database() },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

const emailedCode = (address: string) => {
  const code = execFileSync("mix", ["e2e.email_code", address], {
    cwd: API_DIR,
    env: { ...process.env, MIX_ENV: "dev", DATABASE_URL: database() },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .find((line) => /^\d{6}$/.test(line.trim()));
  if (!code) throw new Error("no code was emailed");
  return code.trim();
};

/** Gym reads that wait until released (scenario L), by gym id. */
const holds = new Map<string, Promise<void>>();
/** While set, gym reads fail as if the network were down (scenario Q). */
let offline = false;

/**
 * The jest-expo environment has no network `fetch`; this is a plain one over
 * node:http (the disposable API is http on loopback). It transports only.
 */
async function networkFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input));
  const gym = url.pathname.match(/^\/api\/v1\/gyms\/([^/]+)$/)?.[1];
  if (gym !== undefined) {
    await holds.get(gym);
    if (offline) throw new TypeError("Network request failed");
  }
  return new Promise((done, fail) => {
    const call = request(
      url,
      {
        method: init.method ?? "GET",
        headers: {
          ...Object.fromEntries(new Headers(init.headers).entries()),
          ...(typeof init.body === "string"
            ? { "content-length": String(Buffer.byteLength(init.body)) }
            : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const body = status === 204 ? null : Buffer.concat(chunks).toString("utf8");
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (typeof value === "string") headers.set(name, value);
          }
          done(new Response(body, { status, headers }));
        });
      },
    );
    call.on("error", fail);
    if (typeof init.body === "string") call.write(init.body);
    call.end();
  });
}

/** A plain HTTP call as any client makes it (the web client, fixtures). */
async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  const response = await networkFetch(`${API_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
}

type Session = Parameters<typeof completeAuthentication>[0] & { access_token: string };
type Account = { email: string; userId: string; session: Session };

const stamp = Date.now();

/** A registered account (email registration, completed account profile). */
async function register(name: string, fullName: string): Promise<Account> {
  const email = `sf89-${name}-${stamp}@example.test`;
  sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  const started = await api<{ registration_token: string }>(
    "POST",
    "/api/auth/email/registrations",
    { email },
  );
  expect(started.status).toBe(202);
  const verified = await api<Session>("POST", "/api/auth/email/registrations/verify", {
    registration_token: started.body.registration_token,
    code: emailedCode(email),
    refresh_token_transport: "body",
  });
  expect(verified.status).toBe(200);
  const session = verified.body;
  const token = session.access_token;
  expect(
    (
      await api(
        "PATCH",
        "/api/v1/me/account-profile",
        {
          full_name: fullName,
          date_of_birth: "1990-05-17",
          accept_terms: true,
          accept_privacy: true,
        },
        token,
      )
    ).status,
  ).toBe(200);
  expect(
    (await api("POST", "/api/v1/me/account-profile/complete-registration", {}, token)).status,
  ).toBe(200);
  const userId = sql(
    `SELECT user_id FROM identities WHERE provider='email' AND provider_subject='${email}'`,
  );
  return { email, userId, session };
}

async function addFighterProfile(account: Account, displayName: string) {
  const token = account.session.access_token;
  const saved = await api(
    "PATCH",
    "/api/v1/me/fighter-profile",
    {
      display_name: displayName,
      username: `sf89${stamp}`.slice(0, 20),
      country_code: "PL",
      city: "Warsaw",
      experience_level: "amateur",
      stance: "orthodox",
    },
    token,
  );
  expect(saved.status).toBe(200);
  expect(
    (await api("POST", "/api/v1/me/fighter-profile/complete-onboarding", {}, token)).status,
  ).toBe(200);
}

async function addCoachProfile(account: Account, displayName: string) {
  const token = account.session.access_token;
  const saved = await api(
    "PATCH",
    "/api/v1/me/coach-profile",
    {
      display_name: displayName,
      country_code: "PL",
      city: "Warsaw",
      coaching_formats: ["personal_training"],
      competition_levels: ["amateur"],
      languages: ["en"],
    },
    token,
  );
  expect(saved.status).toBe(200);
  expect(
    (await api("POST", "/api/v1/me/coach-profile/complete-onboarding", {}, token)).status,
  ).toBe(200);
}

/** A completed gym through the generated client and the signed-in session (the SF-87 calls). */
async function completeGymOnMobile(name: string, city: string): Promise<string> {
  const { gym } = await callWithSession((init) =>
    createGym({ client_request_id: crypto.randomUUID(), name, gym_type: "boxing_club" }, init),
  );
  const { setup } = await callWithSession((init) => getGymSetup(gym.id, init));
  await callWithSession((init) =>
    setGymPrimaryLocation(
      gym.id,
      {
        expected_revision: setup.revision,
        country_code: "PL",
        city,
        address_line: `ul. ${city} 1`,
      },
      init,
    ),
  );
  await callWithSession((init) => completeGymSetup(gym.id, init));
  return gym.id;
}

/** A completed gym through plain HTTP, as the web client creates one (SF-86). */
async function completeGymAsWeb(account: Account, name: string, city: string): Promise<string> {
  const token = account.session.access_token;
  const created = await api<{ gym: { id: string } }>(
    "POST",
    "/api/v1/gyms",
    { client_request_id: crypto.randomUUID(), name, gym_type: "boxing_gym" },
    token,
  );
  expect([200, 201]).toContain(created.status);
  const id = created.body.gym.id;
  const setup = await api<{ setup: { revision: number } }>(
    "GET",
    `/api/v1/gyms/${id}/setup`,
    undefined,
    token,
  );
  const located = await api(
    "PUT",
    `/api/v1/gyms/${id}/setup/primary-location`,
    {
      expected_revision: setup.body.setup.revision,
      country_code: "PL",
      city,
      address_line: `ul. ${city} 2`,
    },
    token,
  );
  expect(located.status).toBe(200);
  expect((await api("POST", `/api/v1/gyms/${id}/complete-setup`, undefined, token)).status).toBe(
    200,
  );
  return id;
}

/** A staff membership in the disposable database (no endpoint creates one before SF-92). */
function seedStaff(gymId: string, userId: string, role: "manager" | "coach" | "front_desk") {
  const out = mixRun(
    `m = SimpleFit.Repo.insert!(%SimpleFit.Gyms.StaffMembership{gym_id: "${gymId}", user_id: "${userId}", role: :${role}, status: :active}); IO.puts("MEMBERSHIP " <> m.id)`,
  );
  const id = out.match(/MEMBERSHIP (\S+)/)?.[1];
  if (!id) throw new Error("no membership was created");
  return id;
}

/** Ends a membership through the domain function, as the gym's owner. */
function revokeStaff(owner: Account, gymId: string, membershipId: string) {
  mixRun(
    `owner = SimpleFit.Repo.get!(SimpleFit.Accounts.User, "${owner.userId}"); {:ok, _} = SimpleFit.Gyms.revoke_staff_membership(owner, "${gymId}", "${membershipId}"); IO.puts("REVOKED")`,
  );
}

/** The production route tree (src/app) under the real providers, as the router test renders it. */
function appContext(): MockContextConfig {
  const dir = join(__dirname, "../app");
  const context: Record<string, unknown> = {};
  for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file) || file === "_layout.tsx") continue;
    Object.defineProperty(context, file.replace(/\.tsx?$/, ""), {
      enumerable: true,
      get: () => jest.requireActual(join(dir, file)),
    });
  }
  const Root = () => (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
  return Object.assign(context, { _layout: { default: Root } }) as MockContextConfig;
}

/**
 * Renders the app at `url`. `renderRouter` turns on Jest's fake timers; the
 * real API answers in real time, so the timers it scheduled run and real
 * timers take over (a fake clock would run every wait out before the network
 * answers).
 */
async function renderApp(url: string) {
  const result = renderRouter(appContext(), { initialUrl: url });
  const rendered = await result;
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  return { ...rendered, getPathname: result.getPathname };
}

const long = { timeout: 15_000 } as const;
const visible = { includeHiddenElements: false } as const;
const pill = (name: string, role: string) =>
  screen.findByRole("button", { name: `${name}, ${role}. Switch gym or profile` }, long);

real("SF-89 real API: gym shell, switching and navigation", () => {
  jest.setTimeout(240_000);

  let owner: Account; // Fighter + Coach + owner of Gym A and Gym B (scenarios A, D, E, G, R)
  let webOwner: Account; // owner of Gym W created as the web does, coach at Gym A (B, C, F, J, M, N)
  let coachOnly: Account; // a CoachProfile and no gym (H)
  let draftOwner: Account; // a draft only (I)
  let gymA = "";
  let gymB = "";
  let gymW = "";
  let staffAtA = "";

  beforeAll(() => {
    expect(sql("SELECT current_database()")).toBe(new URL(database()).pathname.slice(1));
  });

  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    offline = false;
    holds.clear();
    sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  });

  it("A. an owner completes setup on mobile and the Gym intent enters the real Gym pulse", async () => {
    owner = await register("owner", "Alex Owner");
    await completeAuthentication(owner.session);
    gymA = await completeGymOnMobile("SF89 Ring A", "Gdańsk");
    expect(sql(`SELECT setup_status FROM gyms WHERE id='${gymA}'`)).toBe("completed");
    const result = await renderApp("/?intent=gym");
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymA}/pulse`), long);
    expect(await pill("SF89 Ring A", "Owner")).toBeOnTheScreen();
    expect(
      await screen.findByText("Boxing club · Gdańsk, Poland", visible, long),
    ).toBeOnTheScreen();
    expect(await screen.findByText(/ul\. Gdańsk 1/, visible, long)).toBeOnTheScreen();
  });

  it("B/C/S. a gym created as the web does appears on mobile after sign-in, the same record", async () => {
    webOwner = await register("web", "Wiktoria Web");
    gymW = await completeGymAsWeb(webOwner, "SF89 Web Hall", "Poznań");
    await completeAuthentication(webOwner.session);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymW}/pulse`), long);
    expect(await pill("SF89 Web Hall", "Owner")).toBeOnTheScreen();
    const listed = await api<{ gyms: { id: string; name: string }[] }>(
      "GET",
      "/api/v1/me/gyms",
      undefined,
      webOwner.session.access_token,
    );
    expect(listed.body.gyms.map((gym) => [gym.id, gym.name])).toEqual([[gymW, "SF89 Web Hall"]]);
    expect(sql(`SELECT name FROM gyms WHERE id='${gymW}'`)).toBe("SF89 Web Hall");
  });

  it("D/E. two completed gyms: switching shows each gym's own identity and location, and is recorded", async () => {
    await completeAuthentication(owner.session);
    gymB = await completeGymOnMobile("SF89 Ring B", "Kraków");
    const result = await renderApp(`/gyms/${gymA}/pulse`);
    await fireEvent.press(await pill("SF89 Ring A", "Owner"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "SF89 Ring B, Owner · Gym pulse" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymB}/pulse`), long);
    expect(
      await screen.findByText("Boxing club · Kraków, Poland", visible, long),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Boxing club · Gdańsk, Poland", visible)).toBeNull();
    expect(
      sql(
        `SELECT context || ':' || gym_id FROM entry_context_choices WHERE user_id='${owner.userId}'`,
      ),
    ).toBe(`gym:${gymB}`);
  });

  it("F. owner of one gym and coach at another: different roles, the coach never gets the owner's setup", async () => {
    staffAtA = seedStaff(gymA, webOwner.userId, "coach");
    await completeAuthentication(webOwner.session);
    const result = await renderApp(`/gyms/${gymW}/pulse`);
    await fireEvent.press(await pill("SF89 Web Hall", "Owner"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "SF89 Ring A, Coach · Gym pulse" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymA}/pulse`), long);
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible, long),
    ).toBeOnTheScreen();
    const token = webOwner.session.access_token;
    expect(
      (
        await api<{ gym: { viewer: { role: string } } }>(
          "GET",
          `/api/v1/gyms/${gymA}`,
          undefined,
          token,
        )
      ).body.gym.viewer.role,
    ).toBe("coach");
    expect(
      (await api("PATCH", `/api/v1/gyms/${gymA}/setup`, { expected_revision: 1 }, token)).status,
    ).toBe(403);
  });

  it("G/R. Fighter + Coach + Gym owner switches contexts without losing any, and Training and Sessions work", async () => {
    await addFighterProfile(owner, "Alex Fighter");
    await addCoachProfile(owner, "Alex Coach");
    const profiles = sql(
      `SELECT (SELECT count(*) FROM fighter_profiles WHERE user_id='${owner.userId}') || ',' || (SELECT count(*) FROM coach_profiles WHERE user_id='${owner.userId}') || ',' || (SELECT count(*) FROM gym_staff_memberships WHERE user_id='${owner.userId}' AND status='active')`,
    );
    await completeAuthentication(owner.session);
    const result = await renderApp(`/gyms/${gymB}/pulse`);
    await fireEvent.press(await pill("SF89 Ring B", "Owner"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Fighter, Alex Fighter · Fighter home" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/home"), long);
    await act(async () => router.push("/training"));
    await waitFor(() => expect(result.getPathname()).toBe("/training"), long);
    await act(async () => router.push("/workspaces"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach, Alex Coach · Coach today" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"), long);
    await act(async () => router.push("/coach/sessions"));
    await waitFor(() => expect(result.getPathname()).toBe("/coach/sessions"), long);
    await act(async () => router.push("/workspaces"));
    await fireEvent.press(
      await screen.findByRole("button", { name: "SF89 Ring A, Owner · Gym pulse" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymA}/pulse`), long);
    expect(
      sql(
        `SELECT (SELECT count(*) FROM fighter_profiles WHERE user_id='${owner.userId}') || ',' || (SELECT count(*) FROM coach_profiles WHERE user_id='${owner.userId}') || ',' || (SELECT count(*) FROM gym_staff_memberships WHERE user_id='${owner.userId}' AND status='active')`,
      ),
    ).toBe(profiles);
    // Fighter Training answers from the real API. Coach sessions stay behind
    // coaching sharing, which needs approved legal documents (SF-72) that a
    // disposable database does not have, and SF-105's local mode refuses a
    // database it has not approved: 404, as on main, unchanged by SF-89.
    const token = owner.session.access_token;
    expect((await api("GET", "/api/v1/me/training-sessions", undefined, token)).status).toBe(200);
    expect((await api("GET", "/api/v1/me/coach/training-sessions", undefined, token)).status).toBe(
      404,
    );
  });

  it("H. an ordinary CoachProfile grants no gym permission", async () => {
    coachOnly = await register("coach", "Celina Coach");
    await addCoachProfile(coachOnly, "Celina Coach");
    const entry = await api<{ entry: Entry }>(
      "GET",
      "/api/v1/me/entry",
      undefined,
      coachOnly.session.access_token,
    );
    expect(entry.body.entry.capabilities).toEqual(["COACH"]);
    expect(
      (await api("GET", `/api/v1/gyms/${gymA}`, undefined, coachOnly.session.access_token)).status,
    ).toBe(404);
    await completeAuthentication(coachOnly.session);
    const result = await renderApp(`/gyms/${gymA}/pulse`);
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"), long);
  });

  it("I. a draft gym stays resumable and never appears as completed", async () => {
    draftOwner = await register("draft", "Dawid Draft");
    await completeAuthentication(draftOwner.session);
    const { gym } = await callWithSession((init) =>
      createGym(
        { client_request_id: crypto.randomUUID(), name: "SF89 Draft Gym", gym_type: "boxing_gym" },
        init,
      ),
    );
    const entry = await api<{ entry: Entry }>(
      "GET",
      "/api/v1/me/entry",
      undefined,
      draftOwner.session.access_token,
    );
    expect(entry.body.entry.capabilities).toEqual([]);
    expect(entry.body.entry.gym_workspaces).toEqual([
      expect.objectContaining({
        gym_id: gym.id,
        setup_status: "draft",
        available_actions: ["continue_setup"],
      }),
    ]);
    const result = await renderApp(`/gyms/${gym.id}/pulse`);
    // No GYM_WORKSPACE: the entry resumes the owner's setup, never a workspace.
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/gym"), long);
    expect(sql(`SELECT setup_status FROM gyms WHERE id='${gym.id}'`)).toBe("draft");
  });

  it("L. a delayed answer for Gym A never shows inside Gym B", async () => {
    let release = () => {};
    holds.set(gymA, new Promise<void>((done) => (release = done)));
    await completeAuthentication(owner.session);
    const result = await renderApp(`/gyms/${gymA}/pulse`);
    expect(await screen.findByLabelText("Opening the gym…", {}, long)).toBeOnTheScreen();
    await act(async () => router.replace(`/gyms/${gymB}/pulse`));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymB}/pulse`), long);
    expect(await pill("SF89 Ring B", "Owner")).toBeOnTheScreen();
    await act(async () => {
      release();
      // Let the late answer arrive and settle.
      for (let turn = 0; turn < 20; turn += 1) await new Promise((done) => setImmediate(done));
    });
    expect(screen.queryByText("SF89 Ring A", visible)).toBeNull();
  });

  it("O/P/K. deep links: a permitted gym opens; an unknown or foreign gym does not bypass RBAC", async () => {
    await completeAuthentication(draftOwner.session);
    // draftOwner has no workspace: a gym link goes where the entry sends them.
    const blocked = await renderApp(`/gyms/${gymA}/pulse`);
    await waitFor(() => expect(blocked.getPathname()).toBe("/onboarding/gym"), long);
    await blocked.unmount();
    resetSessionForTests();
    await completeAuthentication(webOwner.session);
    const open = await renderApp(`/gyms/${gymW}/pulse`);
    expect(await pill("SF89 Web Hall", "Owner")).toBeOnTheScreen();
    await act(async () => router.replace(`/gyms/${gymB}/pulse`));
    expect(
      await screen.findByRole("header", { name: "This gym isn’t available" }, long),
    ).toBeOnTheScreen();
    expect(screen.queryByText("SF89 Ring B", visible)).toBeNull();
    await act(async () => router.replace("/gyms/00000000-0000-4000-8000-00000000dead/pulse"));
    expect(
      await screen.findByRole("header", { name: "This gym isn’t available" }, long),
    ).toBeOnTheScreen();
    expect(open.getPathname()).toBe("/gyms/00000000-0000-4000-8000-00000000dead/pulse");
  });

  it("J. a revoked staff membership loses access on the next authorized read", async () => {
    await completeAuthentication(webOwner.session);
    await renderApp(`/gyms/${gymA}/pulse`);
    expect(
      await screen.findByText(/The Coach dashboard isn’t available yet/, visible, long),
    ).toBeOnTheScreen();
    revokeStaff(owner, gymA, staffAtA);
    expect(sql(`SELECT status FROM gym_staff_memberships WHERE id='${staffAtA}'`)).toBe("ended");
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(
      await screen.findByRole("header", { name: "This gym isn’t available" }, long),
    ).toBeOnTheScreen();
    await act(async () => focusManager.setFocused(undefined));
    const entry = await api<{ entry: Entry }>(
      "GET",
      "/api/v1/me/entry",
      undefined,
      webOwner.session.access_token,
    );
    expect(entry.body.entry.gym_workspaces.map((gym) => gym.gym_id)).toEqual([gymW]);
  });

  it("Q. a network outage shows the offline state, and recovery loads the real gym", async () => {
    await completeAuthentication(owner.session);
    offline = true;
    await renderApp(`/gyms/${gymA}/pulse`);
    expect(await screen.findByText("You’re offline", {}, long)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Gym pulse" })).toBeNull();
    offline = false;
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await pill("SF89 Ring A", "Owner")).toBeOnTheScreen();
  });

  it("M. account A signs out and account B signs in: nothing of A remains", async () => {
    await completeAuthentication(owner.session);
    const result = await renderApp(`/gyms/${gymA}/pulse`);
    expect(await pill("SF89 Ring A", "Owner")).toBeOnTheScreen();
    await act(async () => {
      await signOut();
    });
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"), long);
    await completeAuthentication(webOwner.session);
    await act(async () => router.replace("/"));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymW}/pulse`), long);
    expect(await pill("SF89 Web Hall", "Owner")).toBeOnTheScreen();
    expect(screen.queryByText("SF89 Ring A", visible)).toBeNull();
    expect(screen.queryByText("SF89 Ring B", visible)).toBeNull();
  });
  it("N. a cold restart restores only valid authorized contexts", async () => {
    // webOwner last chose Gym A, revoked since: the backend ignores it.
    await completeAuthentication(webOwner.session);
    const first = await renderApp("/");
    await waitFor(() => expect(first.getPathname()).toBe(`/gyms/${gymW}/pulse`), long);
    await first.unmount();
    // Restart: memory gone, the refresh token restored from secure storage.
    resetSessionForTests();
    const second = await renderApp("/");
    await waitFor(() => expect(second.getPathname()).toBe(`/gyms/${gymW}/pulse`), long);
    expect(await pill("SF89 Web Hall", "Owner")).toBeOnTheScreen();
  });
});
