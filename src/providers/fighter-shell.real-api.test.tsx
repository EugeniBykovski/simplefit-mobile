import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { request } from "node:http";
import { join, resolve } from "node:path";

import type { QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  type MockContextConfig,
} from "expo-router/testing-library";

import { completeAuthentication, signOut } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { statusForVerifyError } from "@/features/email-auth/model/code-step";
import {
  requestEmailSignIn,
  verifyEmailSignInCode,
} from "@/shared/api/generated/endpoints/auth/auth";

import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

/*
 * SF-160 against the real API and PostgreSQL (scenarios A–G of the ticket):
 * the production Expo Router tree, the five-tab Fighter shell, gates,
 * session layer and generated client, nothing mocked but the transport
 * (`fetch` over node:http to the disposable API) and reduced motion.
 *
 * Accounts are registered through the API's own email registration (the
 * emailed code read with `mix e2e.email_code`) and completed through the
 * account, Fighter and Coach profile endpoints. A coaching relationship and
 * one assigned training session, which only a coach with approved coaching
 * legal documents can create through the API, are inserted in the
 * disposable database as the domains' own structs; the fighter reads them
 * through the API (fighter reads ignore the sharing gate, SF-63). A
 * suspension is applied through `Accounts.Restrictions` under its lock, in
 * the name of a platform operator row inserted for it (no operator ceremony
 * exists in a disposable database). A server-side sign-out of every device is
 * the sessions' own `logout` revocation. Nothing else is seeded.
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
// The app's own QueryClient, unchanged; the isolation scenarios read what it holds.
const mockQueryClients: QueryClient[] = [];
jest.mock("@/shared/api/query-client", () => {
  const actual = jest.requireActual<{ makeQueryClient: () => QueryClient }>(
    "@/shared/api/query-client",
  );
  return {
    ...actual,
    makeQueryClient: () => {
      const client = actual.makeQueryClient();
      mockQueryClients.push(client);
      return client;
    },
  };
});

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

const TRAINING = "/api/v1/me/training-sessions";
/** While set, the fighter's training list waits for it (scenario C). */
let trainingHold: Promise<void> | undefined;
/** Every API path the app requested, in order (scenario E). */
const requested: string[] = [];

/**
 * The jest-expo environment has no network `fetch`; this is a plain one over
 * node:http (the disposable API is http on loopback). It transports only.
 */
async function networkFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input));
  requested.push(url.pathname);
  if (url.pathname === TRAINING) await trainingHold;
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

/** A plain HTTP call as any client makes it (fixtures). */
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
  const email = `sf160-${name}-${stamp}@example.test`;
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

/** A new session for a registered account, through the real email sign-in. */
async function signInByEmail(account: Account): Promise<Session> {
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

/** A completed FighterProfile whose mobile introduction is already done (the home shows). */
async function addFighterProfile(account: Account, displayName: string, username: string) {
  const token = account.session.access_token;
  const saved = await api(
    "PATCH",
    "/api/v1/me/fighter-profile",
    {
      display_name: displayName,
      username,
      country_code: "PL",
      city: "Warsaw",
      experience_level: "amateur",
      stance: "southpaw",
      weight_class: "minus_71",
    },
    token,
  );
  expect(saved.status).toBe(200);
  expect(
    (await api("POST", "/api/v1/me/fighter-profile/complete-onboarding", {}, token)).status,
  ).toBe(200);
  expect(
    (
      await api(
        "PUT",
        "/api/v1/me/first-run/fighter_mobile_first_run",
        { outcome: "completed" },
        token,
      )
    ).status,
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

/** An active relationship and one planned session in two days, as the domains' own structs. */
function seedAssignedSession(coach: Account, fighter: Account, title: string): string {
  const out = mixRun(`
    alias SimpleFit.Repo
    fp = Repo.get_by!(SimpleFit.Fighters.FighterProfile, user_id: "${fighter.userId}")
    cp = Repo.get_by!(SimpleFit.Coaches.CoachProfile, user_id: "${coach.userId}")
    now = DateTime.utc_now()
    rel = Repo.insert!(%SimpleFit.Coaching.Relationship{coach_profile_id: cp.id, fighter_profile_id: fp.id, status: :active, disclosure_version: "sf160-e2e", started_at: now})
    s = Repo.insert!(%SimpleFit.Training.TrainingSession{coach_fighter_relationship_id: rel.id, coach_profile_id: cp.id, fighter_profile_id: fp.id, client_request_id: Ecto.UUID.generate(), title: "${title}", training_type: :pads, starts_at: DateTime.add(now, 2 * 86_400), time_zone: "Europe/Warsaw", duration_minutes: 60, status: :planned})
    IO.puts("SESSION " <> s.id)
  `);
  const id = out.match(/SESSION (\S+)/)?.[1];
  if (!id) throw new Error("no session was created");
  return id;
}

/** Suspends `account` as a platform operator would (SF-122): every session revoked. */
function suspend(account: Account, operatorUser: Account) {
  const out = mixRun(`
    import Ecto.Query
    alias SimpleFit.{Repo, Accounts.Restrictions, Operators.Operator}
    now = DateTime.utc_now()
    # One bootstrap operator per database: the one a previous run left, or a new one.
    op = Repo.one(from(o in Operator, where: o.bootstrap)) || Repo.insert!(%Operator{user_id: "${operatorUser.userId}", status: :active, activated_at: now, bootstrap: true, ceremony_id: Ecto.UUID.generate()})
    {:ok, _} = Repo.transaction(fn ->
      Restrictions.lock!("${account.userId}")
      Restrictions.suspend!("${account.userId}", op.id, "e2e_sf160", now)
    end)
    IO.puts("SUSPENDED")
  `);
  if (!out.includes("SUSPENDED")) throw new Error("the account was not suspended");
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
 * timers take over.
 */
async function renderApp(url: string) {
  const result = renderRouter(appContext(), { initialUrl: url });
  const rendered = await result;
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  return { ...rendered, getPathname: result.getPathname, getSearchParams: result.getSearchParams };
}

const long = { timeout: 15_000 } as const;
const visible = { includeHiddenElements: false } as const;
const appQueryClient = () => mockQueryClients.at(-1)!;
/** Whether the app's cache holds `text` anywhere in its data. */
const cacheHolds = (text: string) =>
  appQueryClient()
    .getQueryCache()
    .getAll()
    .some((query) => JSON.stringify(query.state.data ?? null).includes(text));

real("SF-160 real API: Fighter five-tab shell, workspaces and isolation", () => {
  jest.setTimeout(240_000);

  let fighter: Account; // Fighter (+ Coach since B) with one assigned session
  let coach: Account; // the coach who planned it
  let other: Account; // another Fighter on the same device (C, E, F, G)
  let sessionId = "";
  const TITLE = `SF160 Pads ${stamp}`;

  beforeAll(() => {
    expect(sql("SELECT current_database()")).toBe(new URL(database()).pathname.slice(1));
  });

  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    trainingHold = undefined;
    requested.length = 0;
    sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  });

  it("A. Fighter navigation: Home, Training, a real session, back, Profile", async () => {
    fighter = await register("fighter", "Fiona Fighter");
    await addFighterProfile(fighter, "Fiona Fighter", `sf160f${stamp}`.slice(0, 20));
    coach = await register("coach", "Carl Coach");
    await addCoachProfile(coach, "Carl Coach");
    sessionId = seedAssignedSession(coach, fighter, TITLE);

    await completeAuthentication(fighter.session);
    const result = await renderApp("/");
    await waitFor(() => expect(result.getPathname()).toBe("/home"), long);
    expect(
      await screen.findByRole("button", { name: "Fiona Fighter, Fighter. Switch profile" }, long),
    ).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Home", selected: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Training" }));
    await waitFor(() => expect(result.getPathname()).toBe("/training"), long);
    await fireEvent.press(await screen.findByTestId(`training:row:${sessionId}`, {}, long));
    await waitFor(() => expect(result.getPathname()).toBe(`/sessions/${sessionId}`), long);
    expect(await screen.findByRole("header", { name: TITLE }, long)).toBeOnTheScreen();
    expect(screen.getByTestId("training-session:planned")).toBeOnTheScreen();

    await act(async () => router.back());
    await waitFor(() => expect(result.getPathname()).toBe("/training"), long);
    expect(await screen.findByRole("tab", { name: "Training", selected: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Profile" }));
    await waitFor(() => expect(result.getPathname()).toBe("/profile"), long);
    expect(await screen.findByRole("header", { name: "Fiona Fighter" }, long)).toBeOnTheScreen();
    expect(screen.getByLabelText("Stance: Southpaw")).toBeOnTheScreen();
    expect(screen.getByLabelText("Class: −71")).toBeOnTheScreen();
    // The backend's record is unchanged by reading it.
    expect(sql(`SELECT status FROM training_sessions WHERE id='${sessionId}'`)).toBe("planned");
  });

  it("B. one User, two workspaces: Fighter → Coach → Fighter, nothing of one shown in the other", async () => {
    await addCoachProfile(fighter, "Fiona Coach");
    const usersBefore = sql("SELECT count(*) FROM users");
    await completeAuthentication(fighter.session);
    const result = await renderApp("/training");
    await screen.findByTestId(`training:row:${sessionId}`, {}, long);
    expect(cacheHolds(TITLE)).toBe(true);

    await fireEvent.press(screen.getByRole("tab", { name: "Profile" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Switch workspace" }, long));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach, Fiona Coach · Coach today" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"), long);
    expect(
      await screen.findByRole("header", { name: "Welcome, Fiona Coach" }, long),
    ).toBeOnTheScreen();
    expect(screen.queryByText(TITLE, visible)).toBeNull();
    expect(cacheHolds(TITLE)).toBe(false);
    expect(cacheHolds("Fiona Fighter")).toBe(false);
    expect(sql(`SELECT context FROM entry_context_choices WHERE user_id='${fighter.userId}'`)).toBe(
      "coach",
    );

    await fireEvent.press(
      await screen.findByRole("button", { name: "Fiona Coach, Coach. Switch profile" }, long),
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Fighter, Fiona Fighter · Fighter home" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/home"), long);
    expect(
      await screen.findByRole("button", { name: "Fiona Fighter, Fighter. Switch profile" }, long),
    ).toBeOnTheScreen();
    // The same User throughout: no account was created or duplicated.
    expect(sql("SELECT count(*) FROM users")).toBe(usersBefore);
  });

  it("C. account switching: Fighter A's late answer never reaches Fighter B", async () => {
    other = await register("other", "Oscar Other");
    await addFighterProfile(other, "Oscar Other", `sf160o${stamp}`.slice(0, 20));
    let release: () => void = () => {};
    trainingHold = new Promise((done) => (release = done));

    await completeAuthentication(fighter.session);
    const result = await renderApp("/training");
    await waitFor(() => expect(requested).toContain(TRAINING), long);

    await act(async () => {
      await signOut();
    });
    await waitFor(() => expect(result.getPathname()).not.toBe("/training"), long);
    await completeAuthentication(other.session);
    trainingHold = undefined;
    await act(async () => release());
    await act(async () => router.replace("/training"));
    await waitFor(() => expect(result.getPathname()).toBe("/training"), long);
    expect(await screen.findByText("No upcoming training", visible, long)).toBeOnTheScreen();
    expect(screen.queryByText(TITLE, visible)).toBeNull();
    expect(cacheHolds(TITLE)).toBe(false);
    expect(cacheHolds("Fiona Fighter")).toBe(false);
  });

  it("E. Live Board and Community ask the backend for nothing", async () => {
    await completeAuthentication(other.session);
    const result = await renderApp("/home");
    await screen.findByRole("button", { name: "Oscar Other, Fighter. Switch profile" }, long);
    for (const tab of ["Live Board", "Community"]) {
      requested.length = 0;
      await fireEvent.press(screen.getByRole("tab", { name: tab }));
      await waitFor(
        () => expect(screen.getByRole("tab", { name: tab, selected: true })).toBeOnTheScreen(),
        long,
      );
      expect(await screen.findByLabelText("Planned", {}, long)).toBeOnTheScreen();
      expect(requested.filter((path) => path !== "/api/v1/me/entry")).toEqual([]);
    }
    expect(result.getPathname()).toBe("/community");
  });

  it("F. deep links: another fighter's session is not available; signed out goes to sign-in", async () => {
    await completeAuthentication(other.session);
    const result = await renderApp(`/sessions/${sessionId}`);
    expect(await screen.findByTestId("training-session:unavailable", {}, long)).toBeOnTheScreen();
    expect(screen.queryByText(TITLE, visible)).toBeNull();
    await result.unmount();

    const unknown = await renderApp("/sessions/not-a-session");
    expect(await screen.findByTestId("training-session:unavailable", {}, long)).toBeOnTheScreen();
    await unknown.unmount();

    // A deliberate sign-out returns to the welcome screen, with nothing to return to.
    const signingOut = await renderApp("/profile");
    await screen.findByRole("header", { name: "Oscar Other" }, long);
    await act(async () => {
      await signOut();
    });
    await waitFor(() => expect(signingOut.getPathname()).toBe("/welcome"), long);
    await signingOut.unmount();

    // A cold launch from a link, signed out: sign-in first, then back to it.
    resetSessionForTests();
    const signedOut = await renderApp("/profile");
    await waitFor(() => expect(signedOut.getPathname()).toBe("/login"), long);
    expect(signedOut.getSearchParams()).toEqual({ returnTo: "/profile" });
  });

  it("G. restart restores a valid session; a revoked one lands on sign-in", async () => {
    await completeAuthentication(await signInByEmail(other));
    const first = await renderApp("/profile");
    expect(await screen.findByRole("header", { name: "Oscar Other" }, long)).toBeOnTheScreen();
    await first.unmount();

    // Restart: memory gone, the refresh token restored from secure storage.
    resetSessionForTests();
    const second = await renderApp("/profile");
    expect(await screen.findByRole("header", { name: "Oscar Other" }, long)).toBeOnTheScreen();
    await second.unmount();

    // Revoked on the server (another device signed out everywhere).
    sql(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = 'logout' WHERE user_id='${other.userId}' AND revoked_at IS NULL`,
    );
    resetSessionForTests();
    const third = await renderApp("/profile");
    await waitFor(() => expect(third.getPathname()).toBe("/login"), long);
    expect(screen.queryByRole("header", { name: "Oscar Other" })).toBeNull();
  });

  it("D/R. a suspension revokes the active session; signing in again is refused as suspended", async () => {
    await completeAuthentication(await signInByEmail(fighter));
    const result = await renderApp("/profile");
    expect(await screen.findByRole("header", { name: "Fiona Fighter" }, long)).toBeOnTheScreen();

    suspend(fighter, coach);
    // The next protected read is refused; the session ends and protected UI goes.
    await act(async () => router.push("/training"));
    await waitFor(() => expect(result.getPathname()).toBe("/login"), long);
    expect(
      await screen.findByText("Your session ended. Sign in again to continue.", visible, long),
    ).toBeOnTheScreen();
    expect(screen.queryByText(TITLE, visible)).toBeNull();
    expect(cacheHolds(TITLE)).toBe(false);

    // Signing in again: the code is right, the account is suspended (SF-122).
    sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
    await requestEmailSignIn({ email: fighter.email });
    const refused = await verifyEmailSignInCode({
      email: fighter.email,
      code: emailedCode(fighter.email),
      refresh_token_transport: "body",
    }).catch((error: unknown) => error);
    expect(statusForVerifyError(refused, "sign-in")).toEqual({ status: "suspended" });
  });
});
