const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

/*
 * SF-33: src/shared/routes/mobile-routes.ts is generated from the canonical
 * registry (scripts/generate-mobile-routes.mjs). It must be current, and no
 * runtime-relevant registry field may be lost on the way.
 */
const root = dirname(require.resolve("../package.json"));
const registry = JSON.parse(readFileSync(join(root, "docs/route-registry.json"), "utf8"));
const {
  mobileCapabilities,
  mobileGuards,
  mobileRoutes,
  mobileShells,
} = require("../src/shared/routes/mobile-routes");

const registryRoutes = registry.routes.filter((route) => route.platform === "mobile");
const registryShells = registry.shells.filter((shell) => shell.platform === "mobile");

describe("generated mobile routes", () => {
  it("are in sync with docs/route-registry.json (run pnpm routes:generate)", () => {
    // The generator formats with Prettier (ESM plugins), so it runs in Node, not in Jest.
    const output = execFileSync(
      process.execPath,
      ["scripts/generate-mobile-routes.mjs", "--check"],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    expect(output).toContain("is up to date");
  });

  it("are marked as generated and never hand-edited", () => {
    const source = readFileSync(join(root, "src/shared/routes/mobile-routes.ts"), "utf8");
    expect(source.split("\n").slice(0, 2).join("\n")).toBe(
      "// Generated from docs/route-registry.json by scripts/generate-mobile-routes.mjs.\n" +
        "// Do not edit: change the registry (SF-31) and run `pnpm routes:generate`.",
    );
  });

  it("hold every mobile route exactly once, sorted by id", () => {
    const ids = mobileRoutes.map((route) => route.id);
    expect(ids).toEqual(registryRoutes.map((route) => route.id).sort((a, b) => a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("round-trip id, path, params, shell, parent, navigation type and status", () => {
    for (const route of registryRoutes) {
      const generated = mobileRoutes.find((candidate) => candidate.id === route.id);
      expect(generated).toMatchObject({
        id: route.id,
        path: route.path,
        params: route.params,
        shell: route.shell,
        surface: route.surface,
        parent: route.parent,
        nav: route.nav.type,
        status: route.status,
      });
    }
  });

  it("never drop a canonical access property (session, capability, phase, restrictedAccount)", () => {
    const accessKeys = new Set(registryRoutes.flatMap((route) => Object.keys(route.access)));
    expect([...accessKeys].sort()).toEqual(["capability", "phase", "restrictedAccount", "session"]);

    for (const route of registryRoutes) {
      const generated = mobileRoutes.find((candidate) => candidate.id === route.id);
      for (const key of accessKeys) {
        const expected =
          key === "restrictedAccount" ? route.access[key] === true : route.access[key];
        expect([route.id, key, generated[key]]).toEqual([route.id, key, expected]);
      }
    }
    const restricted = mobileRoutes.filter((route) => route.restrictedAccount).map((r) => r.id);
    expect(restricted.sort()).toEqual([
      "mobile.account.appeal",
      "mobile.account.pending-deletion",
      "mobile.account.suspended",
    ]);
  });

  it("carry every shell with its navigation items", () => {
    expect(mobileShells.map((shell) => shell.id)).toEqual(registryShells.map((shell) => shell.id));
    for (const shell of registryShells) {
      const generated = mobileShells.find((candidate) => candidate.id === shell.id);
      expect(generated.parent).toBe(shell.parent);
      expect(generated.navItems).toEqual(
        (shell.navItems ?? []).map(({ key, route }) => ({ key, route })),
      );
    }
  });

  it("carry the mobile guards and capability destinations", () => {
    const { guards } = registry;
    expect(mobileGuards).toEqual({
      signIn: guards.signIn.mobile,
      entry: guards.entry.mobile,
      notFound: guards.notFound.mobile,
      accountOnboarding: guards.accountOnboarding.mobile,
      workspaceChooser: guards.workspaceChooser.mobile,
      defaultDestinationFallback: guards.defaultDestinationFallback.mobile,
      restrictedAccount: {
        suspended: guards.restrictedAccount.suspended.mobile,
        pendingDeletion: guards.restrictedAccount.pendingDeletion.mobile,
      },
      returnToParam: guards.returnToParam,
    });
    for (const [name, capability] of Object.entries(registry.capabilities)) {
      expect(mobileCapabilities[name]).toEqual({
        home: capability.home.mobile,
        onboarding: capability.onboarding.mobile,
      });
    }
  });
});
