import * as AppleAuthentication from "expo-apple-authentication";
import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { createHash } from "node:crypto";
import { Platform } from "react-native";

import { getSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { AppleSignInButton } from "./apple-sign-in-button";

const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.apple-identity-token-under-test.signature";
const REFRESH = `sfr_${"f".repeat(43)}`;

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

const signIn = jest.mocked(AppleAuthentication.signInAsync);
const available = jest.mocked(AppleAuthentication.isAvailableAsync);

const credential = (identityToken: string | null = ID_TOKEN) =>
  ({
    user: "000123.apple.user",
    identityToken,
    authorizationCode: "c.0.authorization-code",
    fullName: { givenName: "Hidden", familyName: "Person" },
    email: "abc@privaterelay.appleid.com",
    realUserStatus: 2,
    state: null,
  }) as never;

const canceled = () => Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" });

const session = (account: "created" | "existing") =>
  jsonResponse({
    access_token: "sfa_from_apple",
    access_token_expires_at: new Date(Date.now() + 900_000).toISOString(),
    refresh_token: REFRESH,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    refresh_token_transport: "body",
    token_type: "Bearer",
    account,
  });

const apiError = (status: number, code: string) =>
  jsonResponse({ error: { code, message: "ignored by the client", details: {} } }, { status });

const asyncStorageKeys = (): Promise<readonly string[]> =>
  jest
    .requireMock<{ getAllKeys(): Promise<readonly string[]> }>(
      "@react-native-async-storage/async-storage",
    )
    .getAllKeys();

async function renderButton(options = {}) {
  await renderWithProviders(<AppleSignInButton />, options);
}

async function pressContinue() {
  await userEvent.press(await screen.findByRole("button", { name: "Continue with Apple" }));
}

describe("AppleSignInButton", () => {
  beforeEach(() => {
    available.mockResolvedValue(true);
    signIn.mockResolvedValue(credential());
  });

  it.each(["created", "existing"] as const)(
    "sends only the identity token and raw nonce, then enters the app (%s account)",
    async (account) => {
      const fetchMock = mockFetch(jest.fn().mockResolvedValue(session(account)));
      const log = jest.spyOn(console, "log");

      await renderButton();
      await pressContinue();

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
      const [options] = signIn.mock.calls[0] as [{ requestedScopes: unknown[]; nonce: string }];
      expect(options.requestedScopes).toEqual([]);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://api.test/api/auth/apple");
      const body = JSON.parse(String(init.body)) as Record<string, string>;
      expect(Object.keys(body).sort()).toEqual(["id_token", "nonce", "refresh_token_transport"]);
      expect(body.id_token).toBe(ID_TOKEN);
      expect(body.refresh_token_transport).toBe("body");
      expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
      // Apple received the hash of the raw nonce the API receives.
      expect(options.nonce).toBe(
        createHash("sha256")
          .update(body.nonce ?? "")
          .digest("hex"),
      );

      expect(await getSecureItem("simplefit.session.refresh_token")).toBe(REFRESH);
      expect(await asyncStorageKeys()).toEqual([]);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("uses a fresh nonce for every attempt", async () => {
    signIn.mockRejectedValue(canceled());
    await renderButton();
    await pressContinue();
    await pressContinue();

    const nonces = signIn.mock.calls.map(([options]) => (options as { nonce: string }).nonce);
    expect(nonces).toHaveLength(2);
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it("treats a cancelled Apple sheet as no action", async () => {
    signIn.mockRejectedValue(canceled());
    const fetchMock = mockFetch(jest.fn());

    await renderButton();
    await pressContinue();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not call the API without an identity token", async () => {
    signIn.mockResolvedValue(credential(null));
    const fetchMock = mockFetch(jest.fn());

    await renderButton();
    await pressContinue();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("reports an Apple failure other than cancellation generically", async () => {
    signIn.mockRejectedValue(Object.assign(new Error("failed"), { code: "ERR_REQUEST_FAILED" }));
    await renderButton();
    await pressContinue();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it.each([
    [401, "unauthorized", "We couldn't verify your Apple sign-in. Please try again."],
    [429, "rate_limited", "Too many sign-in attempts. Wait a few minutes and try again."],
    [
      503,
      "service_unavailable",
      "Apple sign-in is temporarily unavailable. Please try again later.",
    ],
    [500, "internal_error", "Something went wrong. Please try again."],
  ])("explains a %i %s response", async (status, code, message) => {
    mockFetch(jest.fn().mockResolvedValue(apiError(status, code)));
    await renderButton();
    await pressContinue();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("explains a network failure", async () => {
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));
    await renderButton({ storedLocale: "de" });
    await userEvent.press(await screen.findByRole("button", { name: "Weiter mit Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "SimpleFit ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    );
  });

  it("ignores repeated presses while a sign-in is in flight", async () => {
    mockFetch(jest.fn().mockReturnValue(new Promise(() => undefined)));
    await renderButton();
    const button = await screen.findByRole("button", { name: "Continue with Apple" });
    await userEvent.press(button);
    await userEvent.press(button);
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("is hidden when Sign in with Apple is not available on the device", async () => {
    available.mockResolvedValue(false);
    await renderButton();
    await waitFor(() => expect(available).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).toBeNull();
  });

  it("is hidden on Android without touching the native module", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    try {
      await renderButton();
      expect(screen.queryByRole("button", { name: "Continue with Apple" })).toBeNull();
      expect(available).not.toHaveBeenCalled();
    } finally {
      Platform.OS = os;
    }
  });
});
