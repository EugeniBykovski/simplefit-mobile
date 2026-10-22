import type { ExpoConfig } from "expo/config";

import appConfig, { appLinkHost } from "../../../app.config";
import { parseAppLinkHost } from "./app-link-host";
import { parsePublicEnv } from "./env";

/*
 * SF-80: the domain the native build claims (app.config.ts) and the links the
 * running app accepts (EXPO_PUBLIC_APP_LINK_HOST via src/shared/config) come
 * from the same value under the same rule.
 */

const VALID = [
  "app.example.com",
  " App.Example.COM ",
  "a-b.example.co.uk",
  "xn--bcher-kva.example",
];
const INVALID = [
  "localhost",
  "example",
  "https://app.example.com",
  "app.example.com/",
  "app.example.com:443",
  "*.example.com",
  "127.0.0.1",
  "-app.example.com",
  "app-.example.com",
  "app..example.com",
  "app example.com",
  "user@app.example.com",
];

describe("app link host (SF-80)", () => {
  it("accepts a bare domain name, lower-cased", () => {
    for (const value of VALID) {
      expect(parseAppLinkHost(value)).toBe(value.trim().toLowerCase());
      expect(appLinkHost(value)).toBe(parseAppLinkHost(value));
    }
    expect(parseAppLinkHost(undefined)).toBeUndefined();
    expect(parseAppLinkHost("  ")).toBeUndefined();
    expect(appLinkHost(undefined)).toBeUndefined();
  });

  it("rejects anything else, in the app and in the native config alike", () => {
    for (const value of INVALID) {
      expect(() => parseAppLinkHost(value)).toThrow(/EXPO_PUBLIC_APP_LINK_HOST/);
      expect(() => appLinkHost(value)).toThrow(/EXPO_PUBLIC_APP_LINK_HOST/);
    }
  });

  it("is part of the public environment", () => {
    const env = parsePublicEnv(
      {
        EXPO_PUBLIC_API_URL: "https://api.example.com",
        EXPO_PUBLIC_APP_LINK_HOST: "app.example.com",
      },
      { production: true },
    );
    expect(env.appLinkHost).toBe("app.example.com");
    expect(
      parsePublicEnv({ EXPO_PUBLIC_API_URL: "https://api.example.com" }, { production: true })
        .appLinkHost,
    ).toBeUndefined();
  });
});

describe("native association config (SF-80)", () => {
  const config = () => appConfig({ config: {} } as never) as ExpoConfig;

  it("claims no domain by default", () => {
    // The test environment sets no EXPO_PUBLIC_APP_LINK_HOST.
    expect(process.env.EXPO_PUBLIC_APP_LINK_HOST).toBeUndefined();
    expect(config().ios?.associatedDomains).toBeUndefined();
    expect(config().android?.intentFilters).toBeUndefined();
  });

  it("claims only the invitation path of the configured domain", () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_APP_LINK_HOST = "app.example.com";
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-evaluates the config with the variable set
        const fresh = require("../../../app.config") as { default: typeof appConfig };
        const claimed = fresh.default({ config: {} } as never) as ExpoConfig;
        expect(claimed.ios?.associatedDomains).toEqual(["applinks:app.example.com"]);
        expect(claimed.android?.intentFilters).toEqual([
          {
            action: "VIEW",
            autoVerify: true,
            data: [{ scheme: "https", host: "app.example.com", path: "/invite/coach" }],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ]);
        // The app identity the association files name is unchanged.
        expect(claimed.ios?.bundleIdentifier).toBe("com.simplefit.boxing");
        expect(claimed.android?.package).toBe("com.simplefit.boxing");
      } finally {
        delete process.env.EXPO_PUBLIC_APP_LINK_HOST;
      }
    });
  });
});
