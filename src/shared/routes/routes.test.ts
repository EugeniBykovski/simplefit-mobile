import { mobileRoutes, mobileShells } from "./mobile-routes";
import {
  isTabRoute,
  matchMobileRoute,
  mobileGuards,
  navKeyForRoute,
  routeHref,
  signInHref,
} from "./routes";

describe("routeHref", () => {
  it("resolves static routes to their canonical path", () => {
    expect(routeHref("mobile.home")).toBe("/home");
    expect(routeHref("mobile.gym.staff.on-shift")).toBe("/gym/staff/on-shift");
    expect(routeHref("mobile.root")).toBe("/");
  });

  it("fills named parameters, URL-encoded, and appends the query", () => {
    expect(
      routeHref("mobile.gym._gym-id.classes._class-id.book", { gymId: "g 1", classId: "c/2" }),
    ).toBe("/gym/g%201/classes/c%2F2/book");
    expect(routeHref("mobile.checkout", {}, { from: "pro" })).toBe("/checkout?from=pro");
  });

  it("refuses a missing parameter instead of linking to a literal :param", () => {
    expect(() => routeHref("mobile.messages._thread-id")).toThrow(
      "mobile.messages._thread-id needs the :threadId parameter",
    );
    expect(() => routeHref("mobile.messages._thread-id", { threadId: "" })).toThrow();
  });

  it("never links to a deferred route", () => {
    expect(() => routeHref("mobile.sparring.find")).toThrow("deferred");
  });
});

describe("matchMobileRoute", () => {
  it("resolves every routable mobile route from its own path", () => {
    for (const route of mobileRoutes) {
      if (route.nav === "CATCH_ALL" || route.status === "DEFERRED") continue;
      const path = route.path.replace(/:(\w+)/g, (_match, name: string) => `sample-${name}`);
      expect([path, matchMobileRoute(path)?.id]).toEqual([path, route.id]);
    }
  });

  it("prefers static segments at the first difference, like Expo Router", () => {
    expect(matchMobileRoute("/coach/sessions/abc/roster")?.id).toBe(
      "mobile.coach.sessions._session-id.roster",
    );
    expect(matchMobileRoute("/coach/c1/services/s1")?.id).toBe(
      "mobile.coach._coach-id.services._service-id",
    );
    expect(matchMobileRoute("/gym/pulse")?.id).toBe("mobile.gym.pulse");
    expect(matchMobileRoute("/gym/g1/store")?.id).toBe("mobile.gym._gym-id.store");
    expect(matchMobileRoute("/shared-session/new")?.id).toBe("mobile.shared-session.new");
    expect(matchMobileRoute("/shared-session/s1")?.id).toBe(
      "mobile.shared-session._shared-session-id",
    );
  });

  it("returns nothing for unknown, catch-all and deferred paths", () => {
    expect(matchMobileRoute("/nope")).toBeUndefined();
    expect(matchMobileRoute("/sparring/find")).toBeUndefined();
    expect(matchMobileRoute("/home/extra")).toBeUndefined();
  });

  it("ignores a trailing slash", () => {
    expect(matchMobileRoute("/settings/")?.id).toBe("mobile.settings");
  });
});

describe("navKeyForRoute", () => {
  it("returns the tab that targets the route", () => {
    expect(navKeyForRoute("mobile.fighter", "mobile.home")).toBe("home");
    expect(navKeyForRoute("mobile.gym", "mobile.gym.check-in")).toBe("checkin");
    expect(navKeyForRoute("mobile.coach", "mobile.messages")).toBe("inbox");
  });

  it("assigns child and detail routes to their nearest ancestor's tab", () => {
    expect(navKeyForRoute("mobile.coach", "mobile.coach.fighters._fighter-id.note")).toBe(
      "fighters",
    );
    expect(navKeyForRoute("mobile.gym", "mobile.gym.members._member-id")).toBe("members");
    expect(navKeyForRoute("mobile.gym", "mobile.gym.classes._class-id.roster")).toBe("classes");
    expect(navKeyForRoute("mobile.fighter", "mobile.board.node.gym._gym-id")).toBe("board");
    expect(navKeyForRoute("mobile.fighter", "mobile.profile.fighter._fighter-id")).toBe("profile");
    expect(navKeyForRoute("mobile.coach", "mobile.messages._thread-id")).toBe("inbox");
  });

  it("has no active tab for routes outside the shell's navigation", () => {
    expect(navKeyForRoute("mobile.fighter", "mobile.settings")).toBeUndefined();
    expect(navKeyForRoute("mobile.fighter", undefined)).toBeUndefined();
  });

  it("only targets routes that exist and need no parameters", () => {
    for (const shell of mobileShells) {
      for (const item of shell.navItems) {
        const route = mobileRoutes.find((candidate) => candidate.id === item.route);
        expect(route?.params).toEqual([]);
        expect(route?.status).toBe("IMPLEMENTED");
      }
    }
  });
});

describe("isTabRoute", () => {
  it("is true only for a shell's own tab routes", () => {
    expect(isTabRoute("mobile.home")).toBe(true);
    expect(isTabRoute("mobile.gym.staff.on-shift")).toBe(true);
    expect(isTabRoute("mobile.camp")).toBe(false);
    // The coach Inbox targets the shared /messages, which is pushed above the tabs.
    expect(isTabRoute("mobile.messages")).toBe(false);
  });
});

describe("signInHref", () => {
  it("sends to the registry sign-in route with returnTo", () => {
    expect(mobileGuards.signIn).toBe("mobile.login");
    expect(signInHref("/camp/weight?tab=week")).toBe(
      "/login?returnTo=%2Fcamp%2Fweight%3Ftab%3Dweek",
    );
  });
});
