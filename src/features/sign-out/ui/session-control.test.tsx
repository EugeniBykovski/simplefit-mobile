import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { screen, userEvent } from "@testing-library/react-native";

// The session is per app launch; tests start from a fresh launch.
import { resetSessionForTests } from "@/entities/session/model/session";
import { getSecureItem, setSecureItem } from "@/shared/storage/secure-storage";
import { jsonResponse, mockFetch, renderWithProviders } from "@/test/render";

import { SessionControl } from "./session-control";

const KEY = "simplefit.session.refresh_token";
const REFRESH = `sfr_${"d".repeat(43)}`;

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const restored = () =>
  jsonResponse({
    access_token: "sfa_restored",
    access_token_expires_at: new Date(Date.now() + 900_000).toISOString(),
    refresh_token: `sfr_${"e".repeat(43)}`,
    refresh_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    refresh_token_transport: "body",
    token_type: "Bearer",
  });

describe("SessionControl", () => {
  beforeEach(() => {
    resetSessionForTests();
  });

  it("offers sign-in when there is no session", async () => {
    await renderWithProviders(<SessionControl />);

    expect(await screen.findByText("You're not signed in.")).toBeOnTheScreen();
    await userEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockPush).toHaveBeenCalledWith("/welcome");
  });

  it("signs out: revokes the session, clears SecureStore and signs out of Google", async () => {
    await setSecureItem(KEY, REFRESH);
    const fetchMock = mockFetch(
      jest
        .fn()
        .mockResolvedValueOnce(restored())
        .mockResolvedValueOnce(
          jsonResponse({
            user: {
              id: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
              created_at: "2026-10-01T10:00:00Z",
            },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );

    await renderWithProviders(<SessionControl />, { storedLocale: "de" });
    await userEvent.press(await screen.findByRole("button", { name: "Abmelden" }));

    expect(await screen.findByText("Du bist nicht angemeldet.")).toBeOnTheScreen();
    const [url, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/auth/logout");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sfa_restored");
    expect(await getSecureItem(KEY)).toBeNull();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});
