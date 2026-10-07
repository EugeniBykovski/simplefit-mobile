const { existsSync, readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

/*
 * SF-33: the Expo Router tree materializes the SF-31 mobile route graph.
 * Derived from docs/route-registry.json and the filesystem, never from a
 * second route list. Complements scripts/route-registry.test.js (every route
 * file is a registry route and every implemented route has its file) and
 * src/providers/router.test.tsx (the routes resolve at runtime).
 */
const root = dirname(require.resolve("../package.json"));
const read = (path) => readFileSync(join(root, path), "utf8");
const registry = JSON.parse(read("docs/route-registry.json"));
const routes = registry.routes.filter((route) => route.platform === "mobile");
const shells = new Map(
  registry.shells.filter((shell) => shell.platform === "mobile").map((shell) => [shell.id, shell]),
);
const APP = "src/app";
const ROOT_LAYOUT = `${APP}/_layout.tsx`;

/** Real screens of earlier tickets: SF-33 must never turn them into placeholders. */
const REAL_SCREENS = [
  "mobile.root",
  "mobile.welcome",
  "mobile.login",
  "mobile.app",
  "mobile.dev.design-system",
];

const placeholderSource = (id) => `import { placeholderRoute } from "@/widgets/feature-placeholder";

export default placeholderRoute("${id}");
`;

const approved = routes.filter((route) => route.status !== "DEFERRED");
const groupOf = (shellId) => shells.get(shellId).production.file.split("/").slice(2, -1).join("/");
/**
 * Claude Design: routes whose artboards embed the shell's tab bar (FighterTabs,
 * CoachTabs, GymTabs), by the tab they show active. Each lives in that tab's
 * stack group, so it keeps the tab bar; every other route of a tab shell is
 * pushed above the tabs. A tab item's own route is listed first.
 */
const TAB_SECTIONS = {
  "mobile.fighter": {
    home: ["mobile.home"],
    training: ["mobile.training", "mobile.timer", "mobile.calendar"],
    board: ["mobile.board"],
    community: [
      "mobile.community",
      "mobile.discover",
      "mobile.friends",
      "mobile.following",
      "mobile.challenges",
      "mobile.marketplace",
    ],
    profile: ["mobile.profile", "mobile.progress", "mobile.achievements"],
  },
  "mobile.coach": {
    today: ["mobile.coach.today", "mobile.coach.activity", "mobile.coach.challenge._challenge-id"],
    fighters: ["mobile.coach.fighters"],
    board: ["mobile.coach.board"],
    requests: ["mobile.coach.requests", "mobile.coach.sparring"],
  },
  "mobile.gym": {
    pulse: ["mobile.gym.pulse"],
    classes: ["mobile.gym.classes", "mobile.gym.classes._class-id.roster"],
    checkin: ["mobile.gym.check-in"],
    members: ["mobile.gym.members", "mobile.gym.members._member-id"],
    staff: ["mobile.gym.staff.on-shift"],
  },
};
const tabOf = (route) =>
  Object.entries(TAB_SECTIONS[route.shell] ?? {}).find(([, ids]) => ids.includes(route.id))?.[0];

/** The layout files that wrap `file`, from the app root inwards. */
function layoutChain(file) {
  const chain = [];
  for (let dir = dirname(file); dir.startsWith(APP); dir = dirname(dir)) {
    const layout = join(dir, "_layout.tsx");
    if (existsSync(join(root, layout))) chain.unshift(layout);
  }
  return chain;
}

const kind = (route) => {
  if (route.status === "DEFERRED") return "deferred";
  if (route.nav.type === "CATCH_ALL") return "catchAll";
  const source = read(route.production.file);
  if (source.includes("placeholderRoute(")) return "placeholder";
  return "screen";
};

describe("route resolution strategy", () => {
  it("gives every approved mobile route an Expo Router file", () => {
    const missing = approved.filter(
      (route) =>
        route.status !== "IMPLEMENTED" || !existsSync(join(root, route.production?.file ?? "")),
    );
    expect(missing.map((route) => route.id)).toEqual([]);
  });

  it("builds no deferred route (D-FUTURE-SPARRING)", () => {
    const deferred = routes.filter((route) => route.status === "DEFERRED");
    expect(deferred.map((route) => route.id)).toEqual(["mobile.sparring.find"]);
    expect(existsSync(join(root, APP, "(fighter)/sparring"))).toBe(false);
    expect(deferred.every((route) => route.production === undefined)).toBe(true);
  });

  it("accounts for every route: screens, placeholders, the catch-all and the deferred route", () => {
    const counts = routes.reduce((acc, route) => {
      const key = kind(route);
      return { ...acc, [key]: (acc[key] ?? 0) + 1 };
    }, {});
    expect(counts).toEqual({ screen: 5, catchAll: 1, placeholder: 134, deferred: 1 });
    expect(routes).toHaveLength(141);
  });

  it("makes placeholder files exactly the canonical placeholder module for their own route", () => {
    const wrong = approved
      .filter((route) => kind(route) === "placeholder")
      .filter((route) => read(route.production.file) !== placeholderSource(route.id));
    expect(wrong.map((route) => route.id)).toEqual([]);
  });

  it("keeps the real screens of earlier tickets", () => {
    const replaced = REAL_SCREENS.filter(
      (id) => kind(routes.find((route) => route.id === id)) !== "screen",
    );
    expect(replaced).toEqual([]);
    expect(read(`${APP}/(auth)/welcome.tsx`)).toContain("<WelcomeScreen />");
    expect(read(`${APP}/(auth)/login.tsx`)).toContain("<LoginScreen />");
    expect(read(`${APP}/index.tsx`)).toContain("<FoundationHome />");
  });
});

describe("physical router mapping", () => {
  it("keeps the registry's named parameters as [name] segments", () => {
    const wrong = approved.filter((route) => {
      const names = [...route.production.file.matchAll(/\[(?!\.\.\.)([^\]/]+)\]/g)].map(
        (m) => m[1],
      );
      return JSON.stringify(names) !== JSON.stringify(route.params);
    });
    expect(wrong.map((route) => route.id)).toEqual([]);
  });

  it("puts every route in its shell's route group, and tab routes in their tab's stack", () => {
    const wrong = approved.filter((route) => {
      const group = groupOf(route.shell);
      const tab = tabOf(route);
      const expected = tab ? `${group}/(tabs)/(${tab})` : group;
      const dir = dirname(route.production.file).slice(`${APP}/`.length);
      const groups = dir
        .split("/")
        .filter((part) => /^\(.+\)$/.test(part))
        .join("/");
      return groups !== expected;
    });
    expect(wrong.map((route) => `${route.id} (${route.production.file})`)).toEqual([]);
  });
});

describe("shells", () => {
  it("are implemented as one layout per shell", () => {
    const missing = [...shells.values()].filter(
      (shell) => shell.status !== "IMPLEMENTED" || !existsSync(join(root, shell.production.file)),
    );
    expect(missing.map((shell) => shell.id)).toEqual([]);
    expect([...shells.values()].map((shell) => shell.production.file)).toEqual([
      ROOT_LAYOUT,
      `${APP}/(auth)/_layout.tsx`,
      `${APP}/(onboarding)/_layout.tsx`,
      `${APP}/(fighter)/_layout.tsx`,
      `${APP}/(coach)/_layout.tsx`,
      `${APP}/(gym)/_layout.tsx`,
      `${APP}/(shared)/_layout.tsx`,
    ]);
  });

  it("render every route inside its own shell's layout", () => {
    const wrong = approved.filter(
      (route) =>
        !layoutChain(route.production.file).includes(shells.get(route.shell).production.file),
    );
    expect(wrong.map((route) => `${route.id} (${route.shell})`)).toEqual([]);
  });

  it("never render a route inside a sibling shell's layout", () => {
    const shellFiles = new Map([...shells.values()].map((shell) => [shell.production.file, shell]));
    const wrong = approved.filter((route) =>
      layoutChain(route.production.file).some((layout) => {
        const owner = shellFiles.get(layout);
        if (!owner) return false;
        for (let id = route.shell; id; id = shells.get(id)?.parent)
          if (id === owner.id) return false;
        return true;
      }),
    );
    expect(wrong.map((route) => route.id)).toEqual([]);
  });

  it("declare every shell group on the root stack", () => {
    const groups = [...shells.values()]
      .filter((shell) => shell.production.file !== ROOT_LAYOUT)
      .map((shell) => `"${groupOf(shell.id)}"`);
    const declared = read("src/providers/root-navigator.tsx").match(
      /SHELL_GROUPS = \[([^\]]+)\]/,
    )[1];
    expect(declared.split(", ")).toEqual(groups);
  });

  it("give the tab shells a (tabs) navigator with one stack per tab, rooted at its item's route", () => {
    for (const [shell, name] of [
      ["mobile.fighter", "fighter"],
      ["mobile.coach", "coach"],
      ["mobile.gym", "gym"],
    ]) {
      const group = groupOf(shell);
      expect(read(`${APP}/${group}/(tabs)/_layout.tsx`)).toContain(`<ShellTabs shell="${name}" />`);
      const ownItems = shells
        .get(shell)
        .navItems.filter((item) => routes.find((route) => route.id === item.route).shell === shell);
      expect(ownItems.map((item) => item.key)).toEqual(Object.keys(TAB_SECTIONS[shell]));

      for (const item of ownItems) {
        const dir = `${APP}/${group}/(tabs)/(${item.key})`;
        const rootFile = routes.find((route) => route.id === item.route).production.file;
        expect(TAB_SECTIONS[shell][item.key][0]).toBe(item.route);
        const layout = read(`${dir}/_layout.tsx`);
        expect(layout).toContain("<TabStack root={unstable_settings.initialRouteName} />");
        const root = layout.match(/initialRouteName: "([^"]+)"/)[1];
        expect(`${dir}/${root}.tsx`).toBe(rootFile);
      }
      // Nothing else is in the tab stacks.
      const inTabs = approved
        .filter((route) => route.production.file.startsWith(`${APP}/${group}/(tabs)/`))
        .map((route) => route.id);
      expect(inTabs.sort()).toEqual(Object.values(TAB_SECTIONS[shell]).flat().sort());
    }
  });

  it("keep the tab sections inside their own shell", () => {
    for (const [shell, tabs] of Object.entries(TAB_SECTIONS)) {
      for (const id of Object.values(tabs).flat()) {
        expect([id, routes.find((route) => route.id === id)?.shell]).toEqual([id, shell]);
      }
    }
  });
});

describe("access composition (session part of SF-31 §6)", () => {
  it("guards every shell that has signed-in or guest-only routes with its own SessionGate", () => {
    const wrong = approved
      .filter((route) => route.access.session !== "PUBLIC")
      .filter((route) => {
        const layout = shells.get(route.shell).production.file;
        return !read(layout).includes(
          `<SessionGate shell="${route.shell}" pending={<LaunchScreen />}>`,
        );
      });
    expect(wrong.map((route) => route.id)).toEqual([]);
  });

  it("leaves the root layout and the root routes ungated (all PUBLIC)", () => {
    const rootRoutes = routes.filter((route) => route.shell === "mobile.root");
    expect(rootRoutes.every((route) => route.access.session === "PUBLIC")).toBe(true);
    expect(read(ROOT_LAYOUT)).not.toContain("SessionGate");
  });

  it("keeps the sign-in route GUEST_ONLY and the entry route PUBLIC (no redirect loop)", () => {
    const route = (id) => routes.find((candidate) => candidate.id === id);
    expect(route(registry.guards.signIn.mobile).access.session).toBe("GUEST_ONLY");
    expect(route(registry.guards.entry.mobile).access.session).toBe("PUBLIC");
  });

  it("implements no capability, phase or role check in the router", () => {
    const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const sources = [...shells.values()].map((shell) => code(shell.production.file)).join("\n");
    const gate = code("src/features/session-gate/ui/session-gate.tsx");
    for (const source of [sources, gate]) {
      expect(source).not.toMatch(/\.capability\b|\.phase\b|restrictedAccount\b|\brole\b/);
    }
  });
});

describe("copy", () => {
  const locales = ["en", "ru", "pl", "de", "uk", "es", "fr"];
  const catalog = (locale) => JSON.parse(read(`src/shared/i18n/messages/${locale}.json`));

  it("has a title for every placeholder route in every full locale", () => {
    const placeholders = approved.filter((route) => kind(route) === "placeholder");
    for (const locale of locales) {
      const titles = catalog(locale).routes.titles;
      const missing = placeholders
        .map((route) => route.id.split(".").join("/"))
        .filter((key) => !titles[key]);
      expect([locale, missing]).toEqual([locale, []]);
    }
  });

  it("has a label and an icon for every tab item", () => {
    const icons = read("src/widgets/shell-tabs/model/navigation.ts");
    for (const [shell, name] of [
      ["mobile.fighter", "fighter"],
      ["mobile.coach", "coach"],
      ["mobile.gym", "gym"],
    ]) {
      for (const locale of locales) {
        const labels = catalog(locale).shells[name];
        const missing = shells
          .get(shell)
          .navItems.filter((item) => !labels[item.key])
          .map((item) => item.key);
        expect([locale, shell, missing]).toEqual([locale, shell, []]);
      }
      for (const item of shells.get(shell).navItems)
        expect(icons).toMatch(new RegExp(`\\b${item.key}:`));
    }
  });
});

describe("native authentication and app identity (regression)", () => {
  it("keeps Google and Apple sign-in on the welcome and sign-in screens", () => {
    const screens = read("src/widgets/auth-screens/ui/auth-screens.tsx");
    expect(screens.match(/<GoogleSignInButton/g)).toHaveLength(2);
    expect(screens.match(/<AppleSignInButton/g)).toHaveLength(2);
  });

  it("keeps the native modules and app identity unchanged", () => {
    const { dependencies } = JSON.parse(read("package.json"));
    expect(dependencies).toMatchObject({
      "@react-native-google-signin/google-signin": "16.1.5",
      "expo-apple-authentication": "57.0.2",
      "expo-crypto": "57.0.3",
      "expo-secure-store": "~57.0.4",
      "expo-router": "~57.0.25",
    });
    const config = read("app.config.ts");
    expect(config).toContain('scheme: "simplefit"');
    expect(config.match(/"com\.simplefit\.boxing"/g)).toHaveLength(2);
    expect(config).toContain("usesAppleSignIn: true");
    expect(config).toContain('"expo-router"');
    expect(JSON.parse(read("eas.json")).cli).toBeDefined();
  });
});
