import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { screen, userEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

import { resetGoogleSignInForTests } from "@/shared/lib/google-sign-in";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { GoogleSignInButton } from "./google-sign-in-button";

const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.google-id-token-under-test.signature";
const REFRESH = `sfr_${"c".repeat(43)}`;

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

const signedIn = (idToken: string | null = ID_TOKEN) => ({
  type: "success",
  data: { idToken, user: { id: "google-user" }, scopes: [], serverAuthCode: null },
});

/** AsyncStorage keys (the storage boundary forbids importing it directly). */
const asyncStorageKeys = (): Promise<readonly string[]> =>
  jest
    .requireMock<{ getAllKeys(): Promise<readonly string[]> }>(
      "@react-native-async-storage/async-storage",
    )
    .getAllKeys();

const nativeError = (code: string) => Object.assign(new Error(code), { code });

const session = (account: "created" | "existing") =>
  jsonResponse({
    access_token: "sfa_from_google",
    access_token_expires_at: new Date(Date.now() + 900_000).toISOString(),
    refresh_token: REFRESH,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    refresh_token_transport: "body",
    token_type: "Bearer",
    account,
  });

const apiError = (status: number, code: string) =>
  jsonResponse({ error: { code, message: "ignored by the client", details: {} } }, { status });

async function pressContinue() {
  await userEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
}

/** The provider exchange answers with `exchange`; `GET /api/me` with the viewer (SF-24 pipeline). */
const providerThenViewer = (exchange: Response) =>
  jest.fn((url: string) =>
    Promise.resolve(
      url.endsWith("/api/me")
        ? jsonResponse({
            user: {
              id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
              created_at: "2026-10-01T10:00:00Z",
            },
          })
        : exchange,
    ),
  );

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    resetGoogleSignInForTests();
    jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    jest.mocked(GoogleSignin.signIn).mockResolvedValue(signedIn() as never);
  });

  it.each(["created", "existing"] as const)(
    "exchanges the ID token for a body session and completes the shared session pipeline (%s account)",
    async (account) => {
      const fetchMock = mockFetch(providerThenViewer(session(account)));
      const log = jest.spyOn(console, "log");

      await renderWithProviders(<GoogleSignInButton />);
      await pressContinue();

      expect(GoogleSignin.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          webClientId: "111111111111-webclienttest.apps.googleusercontent.com",
          offlineAccess: false,
        }),
      );
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://api.test/api/auth/google");
      expect(JSON.parse(String(init.body))).toEqual({
        id_token: ID_TOKEN,
        refresh_token_transport: "body",
      });
      // The shared pipeline resolved the viewer; navigation belongs to the gate.
      expect(fetchMock.mock.calls.map(([called]) => String(called))).toContain(
        "http://api.test/api/me",
      );
      expect(mockReplace).not.toHaveBeenCalled();

      // Only the SimpleFit refresh token is persisted, in SecureStore.
      const secure = jest.requireMock<{ __store: Map<string, string> }>(
        "expo-secure-store",
      ).__store;
      expect([...secure.values()]).toEqual([REFRESH]);
      expect(await asyncStorageKeys()).toEqual([]);
      expect(JSON.stringify([...secure.entries()])).not.toContain(ID_TOKEN);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("treats a cancelled Google sheet as no action", async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: "cancelled", data: null } as never);
    const fetchMock = mockFetch(jest.fn());

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["SIGN_IN_CANCELLED", "IN_PROGRESS"])("ignores the native %s error", async (code) => {
    jest.mocked(GoogleSignin.signIn).mockRejectedValue(nativeError(code));

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains missing Google Play services", async () => {
    jest.mocked(GoogleSignin.signIn).mockRejectedValue(nativeError("PLAY_SERVICES_NOT_AVAILABLE"));

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Play services are missing or out of date on this device.",
    );
  });

  it("reports an unknown native error (e.g. DEVELOPER_ERROR) generically", async () => {
    jest.mocked(GoogleSignin.signIn).mockRejectedValue(nativeError("10"));

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("does not call the API when Google returns no ID token", async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue(signedIn(null) as never);
    const fetchMock = mockFetch(jest.fn());

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });

  it.each([
    [401, "unauthorized", "We couldn't verify your Google sign-in. Please try again."],
    [429, "rate_limited", "Too many sign-in attempts. Wait a few minutes and try again."],
    [
      503,
      "service_unavailable",
      "Google sign-in is temporarily unavailable. Please try again later.",
    ],
    [500, "internal_error", "Something went wrong. Please try again."],
  ])("explains a %i %s response", async (status, code, message) => {
    mockFetch(jest.fn().mockResolvedValue(apiError(status, code)));

    await renderWithProviders(<GoogleSignInButton />);
    await pressContinue();

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("explains a network failure", async () => {
    mockFetch(jest.fn().mockRejectedValue(new TypeError("Network request failed")));

    await renderWithProviders(<GoogleSignInButton />, { storedLocale: "pl" });
    await userEvent.press(screen.getByRole("button", { name: "Kontynuuj z Google" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Brak połączenia z SimpleFit. Sprawdź połączenie i spróbuj ponownie.",
    );
  });

  it("checks Google Play services on Android", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    mockFetch(providerThenViewer(session("existing")));

    try {
      await renderWithProviders(<GoogleSignInButton />);
      await pressContinue();
      expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({
        showPlayServicesUpdateDialog: true,
      });
    } finally {
      Platform.OS = os;
    }
  });
});
