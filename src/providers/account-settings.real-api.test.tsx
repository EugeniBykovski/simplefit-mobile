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

import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

/*
 * SF-161 against the real API and PostgreSQL (scenarios A–G of the ticket):
 * Settings (ST1–ST4, S18, ST7, ST13) on the production Expo Router tree,
 * session layer and generated client, nothing mocked but the transport
 * (`fetch` over node:http to the disposable API) and reduced motion.
 * Accounts are registered through the API's own email registration (the
 * emailed code read with `mix e2e.email_code`) and completed through the
 * account, Fighter and Coach profile endpoints. Nothing is seeded.
 *
 * Skipped unless E2E_REAL_API_URL is set:
 *
 *   E2E_REAL_API_URL       the disposable API with SF-161 (never port 4000)
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

/** Every API path the app requested, in order (scenario F). */
const requested: string[] = [];

/**
 * The jest-expo environment has no network `fetch`; this is a plain one over
 * node:http (the disposable API is http on loopback). It transports only.
 */
async function networkFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input));
  requested.push(url.pathname);
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
  const email = `sf161-${name}-${stamp}@example.test`;
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

real("SF-161 real API: Fighter profile, account and settings", () => {
  jest.setTimeout(240_000);

  let fighter: Account; // Fighter + Coach (A–D, G)
  let other: Account; // another Fighter on the same device (E)

  beforeAll(() => {
    expect(sql("SELECT current_database()")).toBe(new URL(database()).pathname.slice(1));
  });

  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    requested.length = 0;
    sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  });

  it("A. ST4 edits the fighter profile; the change persists and F18 shows it", async () => {
    fighter = await register("fighter", "Fiona Fighter");
    await addFighterProfile(fighter, "Fiona Fighter", `sf161f${stamp}`.slice(0, 20));
    await completeAuthentication(fighter.session);
    const result = await renderApp("/settings");
    await fireEvent.press(await screen.findByRole("link", { name: /^Edit profile/ }, long));
    await waitFor(() => expect(result.getPathname()).toBe("/settings/profile"), long);
    await fireEvent.changeText(await screen.findByLabelText("Name", {}, long), "Fiona F.");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(result.getPathname()).toBe("/settings"), long);
    expect(sql(`SELECT display_name FROM fighter_profiles WHERE user_id='${fighter.userId}'`)).toBe(
      "Fiona F.",
    );
    await result.unmount();

    // Reload: a fresh launch reads it back from the backend.
    resetSessionForTests();
    await renderApp("/profile");
    expect(await screen.findByRole("header", { name: "Fiona F." }, long)).toBeOnTheScreen();
  });

  it("A2. ST2 saves the account's full name; the date of birth cannot change", async () => {
    await completeAuthentication(await signInByEmail(fighter));
    await renderApp("/settings/account");
    const name = await screen.findByLabelText("Full name", {}, long);
    expect(name.props.value).toBe("Fiona Fighter");
    await fireEvent.changeText(name, "Fiona Anna Fighter");
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Saved", visible, long)).toBeOnTheScreen();
    expect(sql(`SELECT full_name FROM account_profiles WHERE user_id='${fighter.userId}'`)).toBe(
      "Fiona Anna Fighter",
    );
    // The backend refuses a birth date change after registration (the app offers none).
    const refused = await api(
      "PATCH",
      "/api/v1/me/account-profile",
      { date_of_birth: "1991-01-01" },
      fighter.session.access_token,
    );
    expect(refused.status).toBe(422);
  });

  it("B. S18 persists the product news consent as an append-only record", async () => {
    await completeAuthentication(await signInByEmail(fighter));
    await renderApp("/settings/notifications");
    const toggle = await screen.findByRole("switch", { name: "Product news by email" }, long);
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, "valueChange", true);
    await waitFor(
      () =>
        expect(screen.getByRole("switch", { name: "Product news by email" }).props.value).toBe(
          true,
        ),
      long,
    );
    const profile = await api<{ account_profile: { product_news: { subscribed: boolean } } }>(
      "GET",
      "/api/v1/me/account-profile",
      undefined,
      fighter.session.access_token,
    );
    expect(profile.body.account_profile.product_news.subscribed).toBe(true);
  });

  it("C. ST3 lists the real sign-in method; Settings grants no operator access", async () => {
    await completeAuthentication(await signInByEmail(fighter));
    await renderApp("/settings/security");
    expect(
      await screen.findByLabelText(
        new RegExp(`^Email, ${fighter.email.replace(/[.+]/g, "\\$&")} · a one-time code each time`),
        {},
        long,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^(Google|Apple),/)).toBeNull();
    const admin = await api("GET", "/api/v1/admin/me", undefined, fighter.session.access_token);
    expect(admin.status).toBe(404);
    expect(sql(`SELECT count(*) FROM platform_operators WHERE user_id='${fighter.userId}'`)).toBe(
      "0",
    );
  });

  it("D. switching to the Coach workspace keeps the same global account in Settings", async () => {
    await addCoachProfile(fighter, "Coach Fiona");
    const users = sql("SELECT count(*) FROM users");
    await completeAuthentication(await signInByEmail(fighter));
    const result = await renderApp("/profile");
    await fireEvent.press(await screen.findByRole("button", { name: "Switch workspace" }, long));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Coach, Coach Fiona · Coach today" }, long),
    );
    await waitFor(() => expect(result.getPathname()).toBe("/coach/today"), long);
    await act(async () => router.push("/settings"));
    expect(await screen.findByText("Fiona Anna Fighter", visible, long)).toBeOnTheScreen();
    expect(screen.getByLabelText("Coach")).toBeOnTheScreen();
    expect(screen.getByLabelText("Fighter")).toBeOnTheScreen();
    expect(sql("SELECT count(*) FROM users")).toBe(users);
  });

  it("E. account switching: B never sees A's account settings", async () => {
    other = await register("other", "Oscar Other");
    await addFighterProfile(other, "Oscar Other", `sf161o${stamp}`.slice(0, 20));
    await completeAuthentication(await signInByEmail(fighter));
    const result = await renderApp("/settings/account");
    expect((await screen.findByLabelText("Full name", {}, long)).props.value).toBe(
      "Fiona Anna Fighter",
    );
    await act(async () => {
      await signOut();
    });
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"), long);
    await completeAuthentication(await signInByEmail(other));
    // The welcome screen is guest-only: the signed-in user goes to the entry first.
    await waitFor(() => expect(result.getPathname()).toBe("/home"), long);
    await act(async () => router.push("/settings/account"));
    expect((await screen.findByLabelText("Full name", {}, long)).props.value).toBe("Oscar Other");
    expect(screen.queryByText("Fiona Anna Fighter", visible)).toBeNull();
    expect(screen.queryByLabelText(fighter.email)).toBeNull();
    expect(cacheHolds("Fiona")).toBe(false);
  });

  it("F. Connected apps asks nothing of any integration and shows nothing connected", async () => {
    await completeAuthentication(await signInByEmail(other));
    await renderApp("/settings/apps");
    expect(await screen.findByTestId("settings:apps", {}, long)).toBeOnTheScreen();
    expect(screen.getByText("No connected apps")).toBeOnTheScreen();
    expect(screen.queryAllByRole("switch")).toEqual([]);
    expect(requested.filter((path) => !/^\/api\/(me|auth\/|v1\/me\/entry)/.test(path))).toEqual([]);
  });

  it("G. signing out from Settings ends access; a settings link then needs sign-in", async () => {
    await completeAuthentication(await signInByEmail(other));
    const result = await renderApp("/settings");
    await fireEvent.press(await screen.findByRole("button", { name: "Sign out" }, long));
    await waitFor(() => expect(result.getPathname()).toBe("/welcome"), long);
    // The sign-out finishes (the API is asked to revoke the session) before the restart.
    await waitFor(() => expect(requested).toContain("/api/auth/logout"), long);
    await waitFor(
      () => expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull(),
      long,
    );
    await act(async () => new Promise((settle) => setTimeout(settle, 300)));
    await result.unmount();
    resetSessionForTests();
    const again = await renderApp("/settings/account");
    await waitFor(() => expect(again.getPathname()).toBe("/login"), long);
    expect(again.getSearchParams()).toEqual({ returnTo: "/settings/account" });
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });
});
