import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * SF-70 D1: on iOS, API responses (the refresh response with both tokens
 * included) were stored in the HTTP disk cache, outside SecureStore. The
 * local module `modules/sensitive-http-cache` gives the `expo/fetch` session
 * a cache that holds nothing and purges what earlier builds stored, at launch.
 * The native behaviour is verified on a device (see
 * docs/investigations/sf70-coach-fighter-e2e-hardening.md); this keeps the
 * wiring it depends on from drifting.
 */

const root = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("native HTTP cache protection (SF-70)", () => {
  it("registers the launch subscriber on iOS", () => {
    const config = JSON.parse(read("modules/sensitive-http-cache/expo-module.config.json")) as {
      platforms: string[];
      apple: { appDelegateSubscribers: string[] };
    };
    expect(config.platforms).toContain("apple");
    expect(config.apple.appDelegateSubscribers).toEqual([
      "SensitiveHTTPCacheAppDelegateSubscriber",
    ]);
  });

  it("keeps fetch on expo/fetch, the session the module configures", () => {
    // EXPO_PUBLIC_USE_RN_FETCH would route fetch through React Native's own
    // networking, whose session still uses the shared disk cache.
    for (const file of ["app.config.ts", "eas.json", ".env.example"]) {
      expect(read(file)).not.toMatch(/EXPO_PUBLIC_USE_RN_FETCH/);
    }
  });
});
