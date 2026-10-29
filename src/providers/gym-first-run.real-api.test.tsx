import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
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

import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

/*
 * SF-92 against the real SF-90 API and PostgreSQL (scenarios A–W of the
 * ticket): the gym owner's mobile first run (GR1, GR2) in the production Expo
 * Router tree, gates, session layer and generated client, nothing mocked but
 * the transport (`fetch` over node:http to the disposable API) and reduced
 * motion. The harness is SF-89's (gym-shell.real-api.test.tsx).
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

/** Gym reads that wait until released, by gym id. */
const holds = new Map<string, Promise<void>>();
/** While set, gym reads fail as if the network were down. */
let offline = false;
/** Request paths whose next answer is lost after the server handled them (scenario S). */
const lose = new Set<string>();

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
  return new Promise<Response>((done, fail) => {
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
  }).then((response) => {
    // The server handled it; the phone never hears back (a lost answer).
    if (lose.delete(url.pathname)) throw new TypeError("Network request failed");
    return response;
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
  const email = `sf92-${name}-${stamp}@example.test`;
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
      username: `sf92${stamp}`.slice(0, 20),
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

/** The owner's first-run row: started|completed|dismissed as t/f, or "" when there is none. */
const row = (gymId: string, userId: string) =>
  sql(
    `SELECT (started_at IS NOT NULL) || '|' || (completed_at IS NOT NULL) || '|' || (dismissed_at IS NOT NULL) FROM gym_first_runs WHERE gym_id='${gymId}' AND user_id='${userId}'`,
  );
const rows = (gymId: string) => sql(`SELECT count(*) FROM gym_first_runs WHERE gym_id='${gymId}'`);
const audits = (gymId: string) =>
  sql(
    `SELECT coalesce(string_agg(event_type, ',' ORDER BY occurred_at), '') FROM gym_audit_events WHERE gym_id='${gymId}' AND event_type LIKE 'first_run_%'`,
  );

/** A completed gym's first run as another client (the web, SF-91) reads or moves it. */
const firstRunCall = (method: "GET" | "POST", gymId: string, action: string, token: string) =>
  api<{
    first_run?: { status: string; checklist: { key: string; status: string }[] };
    error?: { code: string; details: Record<string, unknown> };
  }>(
    method,
    `/api/v1/gyms/${gymId}/first-run${action ? `/${action}` : ""}`,
    method === "POST" ? {} : undefined,
    token,
  );

/** Signs in again through the email sign-in API (what the sign-in screens call). */
async function signInAgain(account: Account): Promise<Session> {
  sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  expect((await api("POST", "/api/auth/email/sign-in", { email: account.email })).status).toBe(202);
  const verified = await api<Session>("POST", "/api/auth/email/sign-in/verify", {
    email: account.email,
    code: emailedCode(account.email),
    refresh_token_transport: "body",
  });
  expect(verified.status).toBe(200);
  return verified.body;
}

const header = (name: string) => screen.findByRole("header", { name }, long);
const press = async (name: string) =>
  fireEvent.press(await screen.findByRole("button", { name }, long));

/** Cross-client hand-off with the SF-91 web UI run (opt-in; ids only, no tokens). */
const HANDOFF = process.env.E2E_HANDOFF_FILE ?? "";

real("SF-92 real API: the gym owner's mobile first run", () => {
  jest.setTimeout(300_000);

  let owner: Account; // Fighter + owner of Gym A (completed) and Gym B (dismissed)
  let other: Account; // another account; later manager, then revoked, at Gym A
  let gymA = "";
  let gymB = "";
  let gymC = ""; // for the web leg
  const codes: Record<string, number> = {};

  beforeAll(() => {
    expect(sql("SELECT current_database()")).toBe(new URL(database()).pathname.slice(1));
  });

  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    offline = false;
    holds.clear();
    lose.clear();
    sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  });

  afterAll(() => {
    if (HANDOFF !== "" && owner !== undefined) {
      writeFileSync(HANDOFF, JSON.stringify({ email: owner.email, gymA, gymB, gymC }));
    }
    // The status codes the backend answered, for the report (no tokens, no addresses).
    process.stdout.write(`SF-92 statuses ${JSON.stringify(codes)}\n`);
  });

  it("A–F. setup on mobile → GR1 from the backend → Start (in_progress) → four steps → Finish (completed)", async () => {
    owner = await register("owner", "Alex Owner");
    await addFighterProfile(owner, "Alex O.");
    await completeAuthentication(owner.session);
    gymA = await completeGymOnMobile("SF92 Ring A", "Gdańsk");
    const result = await renderApp("/?intent=gym");
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymA}/pulse`), long);

    // A/B · GR1, not started; reading created nothing; the five rows are the API's.
    expect(await header("Welcome to your gym")).toBeOnTheScreen();
    expect(row(gymA, owner.userId)).toBe("");
    const read = await firstRunCall("GET", gymA, "", owner.session.access_token);
    codes["A GET owner"] = read.status;
    const checklist = read.body.first_run!.checklist;
    expect(checklist.map((item) => item.key)).toEqual([
      "create_gym",
      "add_class",
      "invite_staff",
      "invite_members",
      "first_check_in",
    ]);
    for (const item of checklist)
      expect(screen.getByTestId(`checklist-${item.key}-${item.status}`)).toBeOnTheScreen();
    expect(screen.queryByText(/%|\d+ steps? (left|remaining)/i, visible)).toBeNull();

    // C/D · Start → in_progress on the server, then the tour.
    await press("Start the tour");
    expect(await header("Your opening checklist")).toBeOnTheScreen();
    expect(row(gymA, owner.userId)).toBe("true|false|false");

    // E · every active step; Back and Next record nothing.
    await press("Next");
    expect(
      await screen.findByText(/Name, type and location come straight/, long),
    ).toBeOnTheScreen();
    await press("Back");
    expect(await header("Your opening checklist")).toBeOnTheScreen();
    await press("Next");
    await press("Next");
    expect(await header("Tools arrive in these tabs")).toBeOnTheScreen();
    await press("Next");
    expect(await header("One account, every role")).toBeOnTheScreen();
    expect(row(gymA, owner.userId)).toBe("true|false|false");
    expect(audits(gymA)).toBe("");

    // F · Finish → completed on the server, the audit event, the checklist untouched.
    await press("Finish");
    expect(await header("You know your way around")).toBeOnTheScreen();
    expect(row(gymA, owner.userId)).toBe("true|true|false");
    expect(audits(gymA)).toBe("first_run_completed");
    const after = await firstRunCall("GET", gymA, "", owner.session.access_token);
    expect(after.body.first_run!.checklist).toEqual(checklist);
    await press("Back to Gym pulse");
    expect(await screen.findByText(/Introduction finished\./, visible, long)).toBeOnTheScreen();
  });

  it("G. a cold restart: G01, the introduction never reopens", async () => {
    await completeAuthentication(owner.session);
    const first = await renderApp(`/gyms/${gymA}/pulse`);
    expect(await screen.findByText("Gym details", visible, long)).toBeOnTheScreen();
    await first.unmount();
    resetSessionForTests();
    // Fighter + Gym without an explicit choice: the entry asks where to continue (SF-84).
    const second = await renderApp("/");
    await waitFor(
      () => expect(["/workspaces", `/gyms/${gymA}/pulse`]).toContain(second.getPathname()),
      long,
    );
    await act(async () => router.replace(`/gyms/${gymA}/pulse`));
    expect(await screen.findByText("Gym details", visible, long)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Welcome to your gym" })).toBeNull();
    expect(rows(gymA)).toBe("1");
  });

  it("H. sign out and in again: completion is kept", async () => {
    await completeAuthentication(owner.session);
    const result = await renderApp(`/gyms/${gymA}/pulse`);
    expect(await screen.findByText("Gym details", visible, long)).toBeOnTheScreen();
    await act(async () => {
      await signOut();
    });
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"), long);
    owner.session = await signInAgain(owner);
    await completeAuthentication(owner.session);
    // The entry first: Fighter + Gym without an explicit choice asks where to continue.
    await act(async () => router.replace("/"));
    await waitFor(
      () => expect(["/workspaces", `/gyms/${gymA}/pulse`]).toContain(result.getPathname()),
      long,
    );
    await act(async () => router.replace(`/gyms/${gymA}/pulse`));
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymA}/pulse`), long);
    expect(await screen.findByText("Gym details", visible, long)).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Welcome to your gym" })).toBeNull();
    expect(row(gymA, owner.userId)).toBe("true|true|false");
  });

  it("I/J/U. Gym B: start, background and foreground (no second lifecycle), End introduction → dismissed; A stays completed", async () => {
    await completeAuthentication(owner.session);
    gymB = await completeGymOnMobile("SF92 Ring B", "Gdynia");
    const result = await renderApp(`/gyms/${gymB}/pulse`);
    await waitFor(() => expect(result.getPathname()).toBe(`/gyms/${gymB}/pulse`), long);
    expect(await header("Welcome to your gym")).toBeOnTheScreen();
    await press("Start the tour");
    expect(await header("Your opening checklist")).toBeOnTheScreen();
    // U · background → foreground re-reads the state; nothing new is created.
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await header("Your opening checklist")).toBeOnTheScreen();
    expect(rows(gymB)).toBe("1");
    expect(row(gymB, owner.userId)).toBe("true|false|false");
    focusManager.setFocused(undefined);
    // I · End tour → confirmation → End introduction.
    await press("End tour");
    expect(await header("End the introduction?")).toBeOnTheScreen();
    await press("End introduction");
    expect(await screen.findByText(/Introduction skipped\./, visible, long)).toBeOnTheScreen();
    expect(row(gymB, owner.userId)).toBe("true|false|true");
    expect(audits(gymB)).toBe("first_run_dismissed");
    // J · independent states.
    expect(row(gymA, owner.userId)).toBe("true|true|false");
    // K (API-level, as the web client reads it) · the same persisted outcomes.
    const web = (await firstRunCall("GET", gymB, "", owner.session.access_token)).body.first_run;
    expect(web?.status).toBe("dismissed");
    expect(
      (await firstRunCall("GET", gymA, "", owner.session.access_token)).body.first_run?.status,
    ).toBe("completed");
  });

  it("S. a lost answer to Finish is reconciled with the server, never claimed before it", async () => {
    await completeAuthentication(owner.session);
    gymC = await completeGymOnMobile("SF92 Ring C", "Sopot");
    // Gym C is kept not started for the web leg; Gym S takes the lost answer.
    const gymS = await completeGymOnMobile("SF92 Ring S", "Toruń");
    await renderApp(`/gyms/${gymS}/pulse`);
    await press("Start the tour");
    for (let step = 0; step < 3; step += 1) await press("Next");
    lose.add(`/api/v1/gyms/${gymS}/first-run/complete`);
    await press("Finish");
    // The server kept it; the phone learned that by reading again.
    expect(await header("You know your way around")).toBeOnTheScreen();
    expect(row(gymS, owner.userId)).toBe("true|true|false");
    expect(audits(gymS)).toBe("first_run_completed");
  });

  it("M/O/P/N. an expired session, another account, staff roles and a revoked membership never reach the owner's first run", async () => {
    const token = owner.session.access_token;
    // M · no valid session: 401, nothing recorded.
    const forged = await firstRunCall("POST", gymC, "complete", "sfa_not_a_real_token");
    codes["M complete with an invalid token"] = forged.status;
    expect(forged.status).toBe(401);
    expect(row(gymC, owner.userId)).toBe("");

    // O · another account: 404, nothing disclosed or written.
    other = await register("other", "Bea Other");
    const foreign = await firstRunCall("GET", gymA, "", other.session.access_token);
    codes["O GET foreign"] = foreign.status;
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain("SF92 Ring A");
    const foreignWrite = await firstRunCall("POST", gymC, "dismiss", other.session.access_token);
    codes["O POST dismiss foreign"] = foreignWrite.status;
    expect(foreignWrite.status).toBe(404);

    // P · manager, coach and front desk: 403 for read and write; the UI never asks.
    for (const role of ["manager", "coach", "front_desk"] as const) {
      const staff = await register(`staff-${role}`, `Staff ${role}`);
      seedStaff(gymC, staff.userId, role);
      const read = await firstRunCall("GET", gymC, "", staff.session.access_token);
      const write = await firstRunCall("POST", gymC, "start", staff.session.access_token);
      codes[`P GET ${role}`] = read.status;
      codes[`P POST start ${role}`] = write.status;
      expect([read.status, write.status]).toEqual([403, 403]);
    }
    const membership = seedStaff(gymA, other.userId, "manager");
    resetSessionForTests();
    await completeAuthentication(other.session);
    const requested: string[] = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.includes("/first-run")) requested.push(path);
      return networkFetch(input, init);
    }) as typeof fetch;
    await renderApp(`/gyms/${gymA}/pulse`);
    expect(
      await screen.findByText(/The Manager dashboard isn’t available yet/, visible, long),
    ).toBeOnTheScreen();
    expect(requested).toEqual([]);

    // N · the membership revoked: 404 on the next read.
    revokeStaff(owner, gymA, membership);
    const revoked = await firstRunCall("GET", gymA, "", other.session.access_token);
    codes["N GET revoked"] = revoked.status;
    expect(revoked.status).toBe(404);
    expect(row(gymC, owner.userId)).toBe("");
    expect(token).toBe(owner.session.access_token);
  });

  it("Q/R. two simultaneous completions keep one row; complete racing dismiss keeps one outcome", async () => {
    await completeAuthentication(owner.session);
    const token = owner.session.access_token;
    const gymQ = await completeGymOnMobile("SF92 Ring Q", "Łódź");
    const gymR = await completeGymOnMobile("SF92 Ring R", "Lublin");
    for (const gym of [gymQ, gymR])
      expect((await firstRunCall("POST", gym, "start", token)).status).toBe(200);

    const both = await Promise.all([
      firstRunCall("POST", gymQ, "complete", token),
      firstRunCall("POST", gymQ, "complete", token),
    ]);
    codes["Q complete × 2"] = both[0].status * 1000 + both[1].status;
    expect(both.map((answer) => answer.status)).toEqual([200, 200]);
    expect(rows(gymQ)).toBe("1");
    expect(audits(gymQ)).toBe("first_run_completed");

    const race = await Promise.all([
      firstRunCall("POST", gymR, "complete", token),
      firstRunCall("POST", gymR, "dismiss", token),
    ]);
    const statuses = race.map((answer) => answer.status).sort();
    codes["R complete vs dismiss"] = statuses[0]! * 1000 + statuses[1]!;
    expect(statuses).toEqual([200, 409]);
    expect(rows(gymR)).toBe("1");
    const kept = row(gymR, owner.userId);
    expect(["true|true|false", "true|false|true"]).toContain(kept);
    expect(audits(gymR).split(",")).toHaveLength(1);
    const loser = race.find((answer) => answer.status === 409)!;
    expect(Object.keys(loser.body.error!.details)).toEqual(["first_run"]);
  });

  it("T. a draft gym has no operational introduction", async () => {
    const draftOwner = await register("draft", "Dora Draft");
    const token = draftOwner.session.access_token;
    const created = await api<{ gym: { id: string } }>(
      "POST",
      "/api/v1/gyms",
      { client_request_id: crypto.randomUUID(), name: "SF92 Draft", gym_type: "boxing_club" },
      token,
    );
    const draft = created.body.gym.id;
    const read = await firstRunCall("GET", draft, "", token);
    codes["T GET draft"] = read.status;
    expect(read.body.first_run?.status).toBe("unavailable");
    const start = await firstRunCall("POST", draft, "start", token);
    codes["T POST start draft"] = start.status;
    expect(start.status).toBe(409);
    expect(start.body.error?.details).toEqual({ setup_status: "draft" });
    await completeAuthentication(draftOwner.session);
    // Only a draft: no GYM_WORKSPACE yet, so the gym shell sends the owner on to SF-87 setup.
    const result = await renderApp(`/gyms/${draft}/pulse`);
    await waitFor(() => expect(result.getPathname()).toBe("/onboarding/gym"), long);
    expect(screen.queryByRole("header", { name: "Welcome to your gym" })).toBeNull();
    expect(rows(draft)).toBe("0");
  });

  it("V/W. the Fighter context and its own first run are untouched; local coaching data is unaffected", async () => {
    const token = owner.session.access_token;
    const fighter = await api<{ experiences: { experience: string; status: string }[] }>(
      "GET",
      "/api/v1/me/first-run",
      undefined,
      token,
    );
    expect(fighter.status).toBe(200);
    const mobile = fighter.body.experiences.find(
      (entry) => entry.experience === "fighter_mobile_first_run",
    );
    expect(mobile?.status).toBe("pending");
    await completeAuthentication(owner.session);
    const result = await renderApp("/home");
    await waitFor(() => expect(result.getPathname()).toMatch(/^\/(home|welcome\/tour)$/), long);
    // No first-run row of this run's gyms belongs to anyone but their owner.
    expect(
      sql(
        `SELECT count(*) FROM gym_first_runs WHERE gym_id IN ('${gymA}','${gymB}','${gymC}') AND user_id <> '${owner.userId}'`,
      ),
    ).toBe("0");
  });

  const webCompleted = process.env.E2E_WEB_COMPLETED_GYM ?? "";
  (webCompleted === "" ? it.skip : it)(
    "L. a first run finished in the SF-91 web UI shows as finished on mobile after refresh",
    async () => {
      const handoff = JSON.parse(readFileSync(HANDOFF, "utf8")) as {
        email: string;
      };
      owner = {
        email: handoff.email,
        userId: sql(
          `SELECT user_id FROM identities WHERE provider='email' AND provider_subject='${handoff.email}'`,
        ),
        session: undefined as unknown as Session,
      };
      owner.session = await signInAgain(owner);
      await completeAuthentication(owner.session);
      await renderApp(`/gyms/${webCompleted}/pulse`);
      expect(await screen.findByText("Gym details", visible, long)).toBeOnTheScreen();
      expect(screen.queryByRole("header", { name: "Welcome to your gym" })).toBeNull();
      expect(row(webCompleted, owner.userId)).toBe("true|true|false");
    },
  );
});
