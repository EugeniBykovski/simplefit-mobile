import { parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("accepts an http URL in development and strips trailing slashes", () => {
    expect(
      parsePublicEnv({ EXPO_PUBLIC_API_URL: "http://10.0.2.2:4000//" }, { production: false }),
    ).toEqual({ apiUrl: "http://10.0.2.2:4000" });
  });

  it("requires https in production builds", () => {
    expect(() =>
      parsePublicEnv({ EXPO_PUBLIC_API_URL: "http://api.simplefit.test" }, { production: true }),
    ).toThrow(/https URL in production/);
    expect(
      parsePublicEnv({ EXPO_PUBLIC_API_URL: "https://api.simplefit.test" }, { production: true }),
    ).toEqual({ apiUrl: "https://api.simplefit.test" });
  });

  it("rejects a missing or non-http URL", () => {
    expect(() => parsePublicEnv({}, { production: false })).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() =>
      parsePublicEnv({ EXPO_PUBLIC_API_URL: "ftp://api.simplefit.test" }, { production: false }),
    ).toThrow(/http\(s\) URL/);
  });

  const API = { EXPO_PUBLIC_API_URL: "https://api.simplefit.test" };
  const WEB = "123456789012-web123.apps.googleusercontent.com";
  const IOS = "123456789012-ios456.apps.googleusercontent.com";

  it("reads trimmed Google client IDs", () => {
    expect(
      parsePublicEnv(
        {
          ...API,
          EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: ` ${WEB} `,
          EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: IOS,
        },
        { production: true },
      ),
    ).toEqual({ apiUrl: API.EXPO_PUBLIC_API_URL, googleWebClientId: WEB, googleIosClientId: IOS });
  });

  it("treats missing or empty Google client IDs as not configured", () => {
    const env = parsePublicEnv(
      { ...API, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "", EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: undefined },
      { production: true },
    );
    expect(env.googleWebClientId).toBeUndefined();
    expect(env.googleIosClientId).toBeUndefined();
  });

  it("rejects malformed Google client IDs", () => {
    expect(() =>
      parsePublicEnv(
        { ...API, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "GOCSPX-secret" },
        { production: true },
      ),
    ).toThrow(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID/);
    expect(() =>
      parsePublicEnv(
        { ...API, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: `${IOS}.evil.test` },
        { production: true },
      ),
    ).toThrow(/EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/);
  });
});
