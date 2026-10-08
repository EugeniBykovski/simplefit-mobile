import type { EntryResponseEntry } from "@/shared/api/generated/model";
import { mobileGuards, routeHref } from "@/shared/routes/routes";

import { destinationRoute, entryHref, entryParams } from "./entry";

jest.mock("@/entities/session", () => ({ callWithSession: jest.fn() }));

const entry = (overrides: Partial<EntryResponseEntry> = {}): EntryResponseEntry => ({
  destination: "role_selection",
  reason: "no_role_started",
  mandatory: false,
  intent: null,
  account_registration: "complete",
  fighter_profile: "not_started",
  capabilities: [],
  ...overrides,
});

const ACCOUNT = entry({
  destination: "account_registration",
  reason: "account_registration_incomplete",
  mandatory: true,
  account_registration: "not_started",
});

describe("destinationRoute", () => {
  it("maps the same semantic destinations as the web client to mobile routes", () => {
    expect(routeHref(destinationRoute("account_registration"))).toBe("/signup/consent");
    expect(routeHref(destinationRoute("role_selection"))).toBe("/onboarding/role");
    expect(routeHref(destinationRoute("fighter_onboarding"))).toBe("/onboarding/fighter");
    expect(routeHref(destinationRoute("fighter_home"))).toBe("/home");
    expect(routeHref(destinationRoute("coach_onboarding"))).toBe("/onboarding/coach");
    expect(routeHref(destinationRoute("gym_onboarding"))).toBe("/onboarding/gym");
  });

  it("sends the sponsor application, which has no mobile surface, to the registry fallback", () => {
    expect(mobileGuards.entryDestinations.sponsor_application).toBeNull();
    expect(destinationRoute("sponsor_application")).toBe(mobileGuards.defaultDestinationFallback);
  });
});

describe("entryHref", () => {
  it("the account gate wins over a safe returnTo and keeps the continuation", () => {
    expect(entryHref(ACCOUNT, { returnTo: "/camp/weight", intent: "fighter" })).toBe(
      "/signup/consent?returnTo=%2Fcamp%2Fweight&intent=fighter",
    );
  });

  it("no intent and no role state: role selection, never Fighter", () => {
    expect(entryHref(entry())).toBe("/onboarding/role");
  });

  it("a returnTo behind a capability the backend does not report is kept, not followed", () => {
    expect(entryHref(entry(), { returnTo: "/camp/weight" })).toBe(
      "/onboarding/role?returnTo=%2Fcamp%2Fweight",
    );
  });

  it("a completed fighter may enter Fighter home or a FIGHTER returnTo", () => {
    const home = entry({
      destination: "fighter_home",
      reason: "fighter_onboarding_completed",
      fighter_profile: "completed",
      capabilities: ["FIGHTER"],
    });
    expect(entryHref(home)).toBe("/home");
    expect(entryHref(home, { returnTo: "/camp/weight" })).toBe("/camp/weight");
  });

  it("unfinished Fighter onboarding beats an inaccessible returnTo", () => {
    const onboarding = entry({
      destination: "fighter_onboarding",
      reason: "fighter_onboarding_in_progress",
      mandatory: true,
      fighter_profile: "in_progress",
    });
    expect(entryHref(onboarding, { returnTo: "/home", intent: "fighter" })).toBe(
      "/onboarding/fighter?returnTo=%2Fhome&intent=fighter",
    );
  });

  it.each(["//evil.example", "simplefit://camp", "https://evil.example", "/login", "/"])(
    "never follows or carries the unsafe returnTo %s",
    (returnTo) => {
      expect(String(entryHref(entry(), { returnTo })).split("?")[0]).toBe("/onboarding/role");
    },
  );
});

describe("entryParams", () => {
  it("sends only the validated intent", () => {
    expect(entryParams({})).toBeUndefined();
    expect(entryParams({ intent: "gym", returnTo: "/camp/weight" })).toEqual({ intent: "gym" });
  });
});
