import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";

import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  type MockContextConfig,
} from "expo-router/testing-library";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";

import { AppProviders } from "./app-providers";
import { RootNavigator } from "./root-navigator";

/*
 * SF-100 against the real SF-99 API and PostgreSQL: the mobile leg of the
 * cross-client journey, in the production Expo Router tree, gates, session
 * layer and generated client, nothing mocked but the transport (`fetch`
 * over node:http to the disposable API). It follows the web leg
 * (`e2e/real-api/gym-member-booking.spec.ts` in simplefit-platform), whose
 * handoff file names the member, the gym and the classes (no token):
 *
 * - F · the class the web booked shows as booked on mobile (F13);
 * - G · mobile cancels it (F13's sheet, confirmed);
 * - mobile books another class (its answer lost once; the re-read shows
 *   the booking the API made: one booking), for the web's second leg (H);
 * - the owner's G03 roster on mobile shows the arrival the web recorded.
 *
 * The new class and both sign-ins use the API as another client would.
 * Skipped unless E2E_REAL_API_URL and E2E_HANDOFF_FILE are set:
 *
 *   E2E_REAL_API_URL       the disposable API (never port 4000)
 *   E2E_API_DATABASE_URL   its database ("e2e" in the name, never simple_fit_dev)
 *   E2E_API_DIR            the simplefit-api checkout
 *   E2E_HANDOFF_FILE       the web leg's handoff, extended here for the web's second leg
 */

const API_URL = process.env.E2E_REAL_API_URL ?? "";
const DATABASE_URL = process.env.E2E_API_DATABASE_URL ?? "";
const API_DIR = process.env.E2E_API_DIR ?? "../simplefit-api";
const HANDOFF = process.env.E2E_HANDOFF_FILE ?? "";

jest.mock("@/shared/lib/reduced-motion", () => ({ useReducedMotion: () => true }));
jest.mock("@/shared/config/env", () => ({
  publicEnv: { apiUrl: process.env.E2E_REAL_API_URL ?? "http://unused.invalid" },
}));

const real = API_URL === "" || HANDOFF === "" ? describe.skip : describe;

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

/** Request paths whose next answer is lost after the server handled it. */
const lose = new Set<string>();

/** A plain `fetch` over node:http (jest-expo has no network fetch). It transports only. */
async function networkFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input));
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
    if (init.method === "POST" && lose.delete(url.pathname))
      throw new TypeError("Network request failed");
    return response;
  });
}

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

/** Email sign-in through the API (the same calls the sign-in screens make). */
async function signIn(email: string): Promise<Session> {
  sql("DELETE FROM auth_rate_limits; DELETE FROM rate_limit_events");
  expect((await api("POST", "/api/auth/email/sign-in", { email })).status).toBe(202);
  const verified = await api<Session>("POST", "/api/auth/email/sign-in/verify", {
    email,
    code: emailedCode(email),
    refresh_token_transport: "body",
  });
  expect(verified.status).toBe(200);
  return verified.body;
}

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

async function renderApp(url: string) {
  const result = renderRouter(appContext(), { initialUrl: url });
  const rendered = await result;
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  return { ...rendered, getPathname: result.getPathname };
}

const long = { timeout: 20_000 } as const;
/** F13's day chip label for a wall date (English, as the screen prints it). */
const chip = (date: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

type Handoff = {
  gymId: string;
  memberEmail: string;
  memberId: string;
  ownerEmail: string;
  webBookedClass: { id: string; title: string; date: string };
  todayClass: { id: string; title: string; date: string };
  mobileBookedClass?: { id: string; title: string; date: string };
};

real("SF-100 real API: the mobile leg of member booking and attendance", () => {
  jest.setTimeout(300_000);
  const handoff = (): Handoff => JSON.parse(readFileSync(HANDOFF, "utf8")) as Handoff;
  const statuses: Record<string, number | string> = {};

  beforeAll(() => {
    expect(sql("SELECT current_database()")).toBe(new URL(database()).pathname.slice(1));
  });
  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    lose.clear();
  });
  afterAll(() => {
    process.stdout.write(`SF-100 mobile statuses ${JSON.stringify(statuses)}\n`);
  });

  it("F · G · the web booking shows on mobile and mobile cancels it; mobile books another (lost answer, same key)", async () => {
    const h = handoff();
    // A new class tomorrow at 20:00 (Warsaw), created by the owner as another client.
    const owner = await signIn(h.ownerEmail);
    const venue = sql(`SELECT id FROM gym_venues WHERE gym_id = '${h.gymId}' LIMIT 1`);
    const template = await api<{ template: { template_id: string } }>(
      "POST",
      `/api/v1/gyms/${h.gymId}/class-templates`,
      {
        client_request_id: crypto.randomUUID(),
        title: "Evening pads",
        default_duration_minutes: 45,
        default_capacity: 6,
        default_venue_id: venue,
      },
      owner.access_token,
    );
    expect(template.status).toBe(201);
    // The venue's zone (Europe/Warsaw) offset on that date, as an RFC 3339 suffix.
    const offset =
      new Intl.DateTimeFormat("en", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" })
        .formatToParts(new Date(`${h.webBookedClass.date}T20:00:00Z`))
        .find((part) => part.type === "timeZoneName")
        ?.value.replace("GMT", "") || "+00:00";
    const created = await api<{ occurrence: { occurrence_id: string } }>(
      "POST",
      `/api/v1/gyms/${h.gymId}/class-occurrences`,
      {
        client_request_id: crypto.randomUUID(),
        template_id: template.body.template.template_id,
        starts_at: `${h.webBookedClass.date}T20:00:00${offset}`,
        capacity: 6,
      },
      owner.access_token,
    );
    expect(created.status).toBe(201);
    const evening = created.body.occurrence.occurrence_id;

    // The member on mobile: F13 at account level, no FighterProfile.
    const member = await signIn(h.memberEmail);
    await completeAuthentication(member);
    const result = await renderApp(`/me/gyms/${h.gymId}/classes`);
    await waitFor(() => expect(result.getPathname()).toBe(`/me/gyms/${h.gymId}/classes`), long);
    fireEvent.press(await screen.findByRole("radio", { name: chip(h.webBookedClass.date) }, long));

    // F · the class the web booked is booked here.
    const webRow = await screen.findByTestId(`member-class-${h.webBookedClass.id}`, {}, long);
    expect(webRow.props.accessibilityLabel).toContain("Booked");

    // G · mobile cancels it (confirmed in the sheet).
    fireEvent.press(webRow);
    fireEvent.press(await screen.findByRole("button", { name: "Cancel booking" }, long));
    expect(
      await screen.findByRole("header", { name: "Cancel your booking?" }, long),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Cancel booking" }));
    await waitFor(
      () =>
        expect(
          sql(
            `SELECT count(*) FROM gym_class_bookings WHERE occurrence_id = '${h.webBookedClass.id}' AND status = 'confirmed'`,
          ),
        ).toBe("0"),
      long,
    );
    await waitFor(() => expect(screen.getByTestId("confirm-booking")).toBeOnTheScreen(), long);

    // Mobile books Evening pads; the first answer is lost after the server handled it.
    const path = `/api/v1/me/gym-memberships/${h.memberId}/class-bookings`;
    fireEvent.press(await screen.findByTestId(`member-class-${evening}`, {}, long));
    lose.add(path);
    fireEvent.press(await screen.findByTestId("confirm-booking", {}, long));
    // The answer was lost; the classes are read again and show the booking the
    // API made: the sheet says it is confirmed and offers no second attempt.
    expect(
      await screen.findByText("Booking confirmed. Your place is saved.", {}, long),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/We couldn’t confirm the outcome/)).toBeNull();
    expect(
      sql(
        `SELECT count(*) || '|' || count(DISTINCT client_request_id) FROM gym_class_bookings WHERE occurrence_id = '${evening}'`,
      ),
    ).toBe("1|1");
    statuses.mobileBooking = "one booking after a lost answer";

    writeFileSync(
      HANDOFF,
      JSON.stringify(
        {
          ...h,
          mobileBookedClass: { id: evening, title: "Evening pads", date: h.webBookedClass.date },
        },
        null,
        2,
      ),
    );
  });

  it("the owner's G03 roster on mobile shows the arrival the web recorded", async () => {
    const h = handoff();
    const owner = await signIn(h.ownerEmail);
    await completeAuthentication(owner);
    const result = await renderApp(`/gyms/${h.gymId}/classes/${h.todayClass.id}/roster`);
    await waitFor(
      () => expect(result.getPathname()).toBe(`/gyms/${h.gymId}/classes/${h.todayClass.id}/roster`),
      long,
    );
    expect(await screen.findByText("Marta K.", {}, long)).toBeOnTheScreen();
    expect(screen.getByText("Checked in: 1")).toBeOnTheScreen();
    expect(screen.queryByText(/@/)).toBeNull();
    statuses.mobileRoster = "web check-in visible";
  });
});
