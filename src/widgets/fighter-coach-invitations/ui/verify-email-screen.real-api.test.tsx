import { execFileSync } from "node:child_process";
import { request } from "node:http";
import { resolve } from "node:path";

import { screen, userEvent } from "@testing-library/react-native";

import { completeAuthentication } from "@/entities/session";
import { resetSessionForTests } from "@/entities/session/model/session";
import { renderWithProviders } from "@/test/render";

import { InvitationReviewScreen } from "./invitation-review-screen";
import { InvitationsScreen } from "./invitations-screen";
import { VerifyEmailScreen } from "./verify-email-screen";

/*
 * SF-79 against the real SF-77/SF-73 API and PostgreSQL (Journeys A and B):
 * the app's own screens, session layer and generated client, nothing
 * mocked but navigation. A Google- or Apple-only fighter (provider sign-in
 * cannot run here) is created in the disposable database with SimpleFit's
 * context functions (simplefit-platform e2e/real-api/fixtures/
 * email-link-seed.exs) and signed in with that user's own session.
 *
 * Skipped unless E2E_REAL_API_URL is set:
 *
 *   E2E_REAL_API_URL       the disposable API (never port 4000)
 *   E2E_API_DATABASE_URL   its database ("e2e" in the name, never simple_fit_dev)
 *   E2E_API_DIR            the simplefit-api checkout (default ../simplefit-api)
 *   E2E_SEED               the seed script (default ../simplefit-platform/…/email-link-seed.exs)
 */

const API_URL = process.env.E2E_REAL_API_URL ?? "";
const DATABASE_URL = process.env.E2E_API_DATABASE_URL ?? "";
const API_DIR = resolve(process.env.E2E_API_DIR ?? "../simplefit-api");
const SEED = resolve(
  process.env.E2E_SEED ?? "../simplefit-platform/e2e/real-api/fixtures/email-link-seed.exs",
);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
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

function mix(args: string[], extra: Record<string, string> = {}): string {
  return execFileSync("mix", args, {
    cwd: API_DIR,
    env: { ...process.env, ...extra, MIX_ENV: "dev", DATABASE_URL: database() },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function seed(...args: string[]): Record<string, string> {
  const output = mix(["run", SEED, ...args], {
    COACHING_ACCESS_ENABLED: "true",
    COACHING_DISCLOSURES: "fighter-coach-disclosure-test-1=basic_profile",
    COACHING_DATA_RULES_VERSION: "coach-data-rules-test-1",
  });
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim().split(" "))
      .filter((parts) => parts.length === 2 && /^[A-Z]+$/.test(parts[0] ?? ""))
      .map(([key, value]) => [key, value]),
  );
}

const sql = (query: string) =>
  execFileSync("psql", [database(), "-Atc", query], { encoding: "utf8" }).trim();

const emailedCode = (address: string) => {
  const code = mix(["e2e.email_code", address])
    .split("\n")
    .find((line) => /^\d{6}$/.test(line.trim()));
  if (!code) throw new Error("no code was emailed");
  return code.trim();
};

/** The seeded session, signed in through the app's own pipeline. */
async function signInWith(refresh: string | undefined) {
  const response = await fetch(`${API_URL}/api/auth/session/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (response.status !== 200) throw new Error(`refresh ${response.status}`);
  await completeAuthentication(
    (await response.json()) as Parameters<typeof completeAuthentication>[0],
  );
}

/**
 * The jest-expo environment has no network `fetch`; this is a plain one over
 * node:http (the disposable API is http on loopback). It transports only.
 */
function networkFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input));
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

const user = userEvent.setup();

real("SF-79 real API (Journeys A and B)", () => {
  jest.setTimeout(120_000);

  beforeEach(() => {
    global.fetch = networkFetch as typeof fetch;
    resetSessionForTests();
    sql("DELETE FROM auth_rate_limits");
  });

  it.each([
    ["google", `sf79-google-${Date.now()}`, "email,google"],
    ["apple", `000779.sf79${Date.now()}`, "apple,email"],
  ])(
    "%s-only fighter links the invited address, sees the invitation and accepts explicitly",
    async (provider, subject, providers) => {
      const email = `sf79-${provider}-${Date.now()}@example.test`;
      const { INVITE } = seed("invite", email);
      expect(INVITE).toMatch(/^sfi_/);
      const { REFRESH } = seed("user", provider, subject, "fighter");
      const userId = sql(
        `SELECT user_id FROM identities WHERE provider='${provider}' AND provider_subject='${subject}'`,
      );
      const users = sql("SELECT count(*) FROM users");
      await signInWith(REFRESH);

      // Before: the inbox does not reach the invitation.
      const inbox = await renderWithProviders(
        <>
          <InvitationsScreen />
          <VerifyEmailScreen />
        </>,
      );
      expect(await screen.findByText("No invitations", {}, { timeout: 10_000 })).toBeOnTheScreen();

      await user.type(screen.getByLabelText("Email address"), email);
      await user.press(screen.getByRole("button", { name: "Send code" }));
      const field = await screen.findByLabelText("6-digit code", {}, { timeout: 10_000 });
      // A 202 links nothing.
      expect(sql(`SELECT count(*) FROM identities WHERE provider_subject='${email}'`)).toBe("0");
      await user.type(field, emailedCode(email));
      expect(
        await screen.findByRole("header", { name: "Email verified" }, { timeout: 10_000 }),
      ).toBeOnTheScreen();

      // The same user owns it; nothing else was created or accepted.
      expect(
        sql(
          `SELECT user_id FROM identities WHERE provider='email' AND provider_subject='${email}'`,
        ),
      ).toBe(userId);
      expect(
        sql(
          `SELECT string_agg(provider, ',' ORDER BY provider) FROM identities WHERE user_id='${userId}'`,
        ),
      ).toBe(providers);
      expect(sql("SELECT count(*) FROM users")).toBe(users);

      // The inbox was read again: the invitation is there, pending.
      const row = await screen.findByRole(
        "button",
        { name: /^Coach Marek, Pending/ },
        { timeout: 10_000 },
      );
      await user.press(row);
      const target = String(mockRouter.push.mock.calls.at(-1)?.[0] ?? "");
      const invitationId = target.split("/").pop() ?? "";
      expect(invitationId).toMatch(/^[0-9a-f-]{36}$/);
      await inbox.unmount();

      // FCI2: the backend's preview, explicit confirmation, then accept.
      const fighterProfile = sql(`SELECT id FROM fighter_profiles WHERE user_id='${userId}'`);
      const active = () =>
        sql(
          `SELECT count(*) FROM coach_fighter_relationships WHERE fighter_profile_id='${fighterProfile}' AND status='active'`,
        );
      expect(active()).toBe("0");
      await renderWithProviders(<InvitationReviewScreen invitationId={invitationId} />);
      const accept = await screen.findByRole(
        "button",
        { name: "Accept invitation" },
        { timeout: 10_000 },
      );
      expect(accept).toBeDisabled();
      await user.press(screen.getByRole("checkbox"));
      await user.press(accept);
      expect(
        await screen.findByText(/You’re connected with Coach Marek/, {}, { timeout: 10_000 }),
      ).toBeOnTheScreen();
      expect(active()).toBe("1");
      expect(sql("SELECT count(*) FROM users")).toBe(users);
    },
  );
});
