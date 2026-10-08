import { continuationOf, continuationQuery, parseIntent, withContinuation } from "./continuation";

describe("parseIntent", () => {
  it("accepts exactly the backend's allow-list", () => {
    for (const intent of ["fighter", "coach", "gym", "sponsor"]) {
      expect(parseIntent(intent)).toBe(intent);
    }
  });

  it.each(["Fighter", "FIGHTER", " fighter", "admin", "gym_workspace", "", null, 1, ["fighter"]])(
    "rejects %j",
    (value) => {
      expect(parseIntent(value)).toBeUndefined();
    },
  );
});

describe("continuationOf", () => {
  it("reads returnTo and intent from route params", () => {
    expect(continuationOf({ returnTo: "/camp/weight", intent: "fighter" })).toEqual({
      returnTo: "/camp/weight",
      intent: "fighter",
    });
  });

  it("drops anything not allowed and never guesses between repeated values", () => {
    expect(continuationOf({ returnTo: "simplefit://camp", intent: "admin" })).toEqual({});
    expect(continuationOf({ returnTo: "//evil.example" })).toEqual({});
    expect(continuationOf({ intent: ["fighter", "coach"] })).toEqual({});
    expect(continuationOf({ returnTo: "/onboarding/role" })).toEqual({});
    expect(continuationOf({})).toEqual({});
  });
});

describe("continuationQuery and withContinuation", () => {
  it("carry the valid continuation along an auth step", () => {
    expect(withContinuation("mobile.signup", { intent: "coach" })).toBe("/signup?intent=coach");
    expect(withContinuation("mobile.login.code", { returnTo: "/camp/weight", intent: "gym" })).toBe(
      "/login/code?returnTo=%2Fcamp%2Fweight&intent=gym",
    );
    expect(withContinuation("mobile.login")).toBe("/login");
  });

  it("re-validate what they carry", () => {
    const forged = { returnTo: "//evil.example", intent: "admin" } as unknown as Parameters<
      typeof continuationQuery
    >[0];
    expect(continuationQuery(forged)).toEqual({});
  });
});
