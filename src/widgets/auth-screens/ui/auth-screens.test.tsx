import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

import { pending } from "@/features/email-auth/model/pending";
import { resetSessionForTests } from "@/entities/session/model/session";
import { getSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import {
  LoginScreen,
  SignInCodeScreen,
  SignUpScreen,
  VerifyEmailScreen,
  WelcomeScreen,
} from "./auth-screens";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
const mockParams: { current: Record<string, string> } = { current: {} };
const mockRedirect = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

const EMAIL = "fighter@example.com";
const CODE = "482910";
const REGISTRATION_TOKEN = "sfg_registration-token-under-test";
const REFRESH = `sfr_${"c".repeat(43)}`;
const VIEWER = { id: "8a6e0804-2bd0-4672-b79d-d97027f9071b", created_at: "2026-10-01T10:00:00Z" };

const tokens = () =>
  jsonResponse({
    access_token: "sfa_email",
    access_token_expires_at: new Date(Date.now() + 900_000).toISOString(),
    refresh_token: REFRESH,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    refresh_token_transport: "body",
    token_type: "Bearer",
  });
const accepted = () =>
  jsonResponse({ expires_in_seconds: 600, resend_after_seconds: 60 }, { status: 202 });
const registrationAccepted = () =>
  jsonResponse(
    { registration_token: REGISTRATION_TOKEN, expires_in_seconds: 600, resend_after_seconds: 60 },
    { status: 202 },
  );
const apiError = (status: number, code: string, headers: Record<string, string> = {}) =>
  jsonResponse(
    { error: { code, message: "ignored by the client", details: {} } },
    { status, headers },
  );

type Call = [string, RequestInit];
/** Answers by path; each path's answers are used in order, the last one repeats. */
function api(routes: Record<string, (() => Response)[]>) {
  const seen = new Map<string, number>();
  return mockFetch(
    jest.fn((url: string) => {
      const path = new URL(url).pathname;
      const answers = routes[path];
      if (!answers) throw new Error(`unexpected request ${path}`);
      const index = seen.get(path) ?? 0;
      seen.set(path, index + 1);
      return Promise.resolve(answers[Math.min(index, answers.length - 1)]!());
    }),
  );
}
const sent = (fetchMock: jest.Mock) =>
  (fetchMock.mock.calls as Call[]).map(([url, init]) => ({
    path: url.replace("http://api.test", ""),
    body: init.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
  }));

/** AsyncStorage keys (the storage boundary forbids importing it directly). */
const asyncStorageKeys = (): Promise<readonly string[]> =>
  jest
    .requireMock<{ getAllKeys(): Promise<readonly string[]> }>(
      "@react-native-async-storage/async-storage",
    )
    .getAllKeys();

beforeEach(() => {
  resetSessionForTests();
  mockParams.current = {};
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRedirect.mockClear();
  pending.clear("signIn");
  pending.clear("registration");
});

describe("A01 welcome", () => {
  it("offers Google, Apple and email, and links to sign-in", async () => {
    await renderWithProviders(<WelcomeScreen />);

    expect(screen.getByRole("header", { name: "Join the boxing community." })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Continue with Apple" })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Continue with Email" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/signup");
    await userEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/login");
  });

  it("hides the invite and brands links until their routes can take them", async () => {
    await renderWithProviders(<WelcomeScreen />);
    expect(screen.queryByText(/invite|Brands/i)).toBeNull();
  });

  it("carries a valid returnTo and drops an unsafe one", async () => {
    mockParams.current = { returnTo: "/camp/weight" };
    const { unmount } = await renderWithProviders(<WelcomeScreen />);
    await userEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(mockRouter.push).toHaveBeenLastCalledWith("/login?returnTo=%2Fcamp%2Fweight");
    await unmount();

    mockParams.current = { returnTo: "simplefit://evil" };
    await renderWithProviders(<WelcomeScreen />);
    await userEvent.press(screen.getByRole("link", { name: "Sign in" }));
    expect(mockRouter.push).toHaveBeenLastCalledWith("/login");
  });
});

describe("O01b sign in", () => {
  it("offers compact Google and Apple, then requests an email code (enumeration-safe)", async () => {
    const fetchMock = api({ "/api/auth/email/sign-in": [accepted] });
    await renderWithProviders(<LoginScreen />);

    expect(screen.getByRole("button", { name: "Google" })).toBeOnTheScreen();
    expect(await screen.findByRole("button", { name: "Apple" })).toBeOnTheScreen();
    expect(screen.queryByText(/Recover/i)).toBeNull();
    await userEvent.type(screen.getByLabelText("Email"), "  Fighter@Example.COM ");
    await userEvent.press(screen.getByRole("button", { name: "Email me a sign-in code" }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/login/code"));
    expect(sent(fetchMock)).toEqual([{ path: "/api/auth/email/sign-in", body: { email: EMAIL } }]);
    expect(pending.get("signIn")).toMatchObject({ email: EMAIL });
  });

  it("shows an invalid address inline without calling the API", async () => {
    const fetchMock = api({});
    await renderWithProviders(<LoginScreen />);

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.press(screen.getByRole("button", { name: "Email me a sign-in code" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("O02 create account", () => {
  it("asks for the email address only and starts a registration", async () => {
    const fetchMock = api({ "/api/auth/email/registrations": [registrationAccepted] });
    mockParams.current = { returnTo: "/workspaces" };
    await renderWithProviders(<SignUpScreen />);

    // O02 draws Full name above Email: presentation only, never editable or sent
    // (the registration API owns the address only; SF-25 adds profile data).
    const fullName = screen.getByLabelText("Full name");
    expect(fullName).toBeDisabled();
    expect(fullName.props.editable).toBe(false);
    await userEvent.type(screen.getByLabelText("Email"), EMAIL);
    await userEvent.press(screen.getByRole("button", { name: "Continue with email" }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/signup/verify?returnTo=%2Fworkspaces"),
    );
    expect(sent(fetchMock)).toEqual([
      { path: "/api/auth/email/registrations", body: { email: EMAIL } },
    ]);
  });
});

describe("O01c sign-in code", () => {
  const seed = () => pending.set("signIn", { email: EMAIL, resendAt: Date.now() + 60_000 });

  it("returns to the email step without a pending sign-in", async () => {
    await renderWithProviders(<SignInCodeScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("verifies the code (body transport), stores the session and stays put for the gate", async () => {
    seed();
    const fetchMock = api({
      "/api/auth/email/sign-in/verify": [tokens],
      "/api/me": [() => jsonResponse({ user: VIEWER })],
    });
    await renderWithProviders(<SignInCodeScreen />);

    expect(screen.getByText(/If there’s a SimpleFit account for/)).toBeOnTheScreen();
    expect(screen.getByText(/Code sent\. It expires in 10 minutes/)).toBeOnTheScreen();
    await userEvent.type(screen.getByLabelText("6-digit code"), CODE);

    expect(await screen.findByText("You’re signed in.")).toBeOnTheScreen();
    expect(sent(fetchMock)).toEqual([
      {
        path: "/api/auth/email/sign-in/verify",
        body: { email: EMAIL, code: CODE, refresh_token_transport: "body" },
      },
      { path: "/api/me", body: undefined },
    ]);
    expect(await getSecureItem("simplefit.session.refresh_token")).toBe(REFRESH);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(await asyncStorageKeys()).toEqual([]);
  });

  it("shows a wrong code, an expired code with a new challenge, and throttling", async () => {
    seed();
    const fetchMock = api({
      "/api/auth/email/sign-in/verify": [
        () => apiError(422, "code_invalid"),
        () => apiError(422, "code_expired"),
        () => apiError(429, "rate_limited", { "retry-after": "30" }),
      ],
      "/api/auth/email/sign-in": [accepted],
    });
    await renderWithProviders(<SignInCodeScreen />);
    const input = screen.getByLabelText("6-digit code");

    await userEvent.type(input, "000000");
    expect(await screen.findByText(/That code isn’t right/)).toBeOnTheScreen();

    await userEvent.clear(input);
    await userEvent.type(input, CODE);
    expect(await screen.findByText(/This code has expired/)).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Send a new code" }));
    expect(await screen.findByText(/We sent a new code/)).toBeOnTheScreen();
    expect(sent(fetchMock)[2]).toEqual({
      path: "/api/auth/email/sign-in",
      body: { email: EMAIL },
    });

    await userEvent.type(input, CODE);
    expect(await screen.findByText("Resend unavailable for now")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("offers Open Mail on iOS only, through the system URL handler", async () => {
    seed();
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { unmount } = await renderWithProviders(<SignInCodeScreen />);
    await userEvent.press(screen.getByRole("button", { name: "Open Mail app" }));
    expect(open).toHaveBeenCalledWith("message://");
    await unmount();

    const os = Platform.OS;
    Platform.OS = "android";
    try {
      seed();
      await renderWithProviders(<SignInCodeScreen />);
      expect(screen.queryByRole("button", { name: "Open Mail app" })).toBeNull();
    } finally {
      Platform.OS = os;
    }
  });
});

describe("O03 verify email", () => {
  const seed = () =>
    pending.set("registration", {
      email: EMAIL,
      registrationToken: REGISTRATION_TOKEN,
      resendAt: Date.now() + 60_000,
    });

  it("verifies with the registration token on this device", async () => {
    seed();
    const fetchMock = api({
      "/api/auth/email/registrations/verify": [tokens],
      "/api/me": [() => jsonResponse({ user: VIEWER })],
    });
    await renderWithProviders(<VerifyEmailScreen />);

    await userEvent.type(screen.getByLabelText("6-digit code"), CODE);

    expect(await screen.findByText("Email verified on this device.")).toBeOnTheScreen();
    expect(sent(fetchMock)[0]).toEqual({
      path: "/api/auth/email/registrations/verify",
      body: { registration_token: REGISTRATION_TOKEN, code: CODE, refresh_token_transport: "body" },
    });
  });

  it("verified elsewhere: requests a NEW sign-in challenge, never reusing the registration token", async () => {
    seed();
    mockParams.current = { returnTo: "/workspaces" };
    const fetchMock = api({
      "/api/auth/email/registrations/verify": [() => apiError(409, "verified_elsewhere")],
      "/api/auth/email/sign-in": [accepted],
    });
    await renderWithProviders(<VerifyEmailScreen />);

    await userEvent.type(screen.getByLabelText("6-digit code"), CODE);
    expect(
      await screen.findByText(/This email was verified from another device/),
    ).toBeOnTheScreen();
    await act(async () => {
      await userEvent.press(screen.getByRole("button", { name: "Send a new code" }));
    });

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith("/login/code?returnTo=%2Fworkspaces"),
    );
    const handOff = sent(fetchMock)[1]!;
    expect(handOff).toEqual({ path: "/api/auth/email/sign-in", body: { email: EMAIL } });
    expect(JSON.stringify(handOff.body)).not.toContain(REGISTRATION_TOKEN);
    expect(pending.get("registration")).toBeUndefined();
    expect(pending.get("signIn")).toMatchObject({ email: EMAIL });
  });
});
