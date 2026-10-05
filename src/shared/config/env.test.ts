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
});
