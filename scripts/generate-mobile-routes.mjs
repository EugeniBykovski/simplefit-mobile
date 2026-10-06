#!/usr/bin/env node
/*
 * Generates src/shared/routes/mobile-routes.ts from the canonical route
 * registry (docs/route-registry.json, SF-31): the mobile routes with their
 * path, parameters, shell, parent, navigation type, status and complete
 * access (session, capability, phase, restrictedAccount), the shells'
 * navigation items, the mobile guards and the capabilities' mobile home and
 * onboarding routes. Application code links through this module, never
 * through handwritten paths (route-architecture §14).
 *
 *   node scripts/generate-mobile-routes.mjs           write the module
 *   node scripts/generate-mobile-routes.mjs --check   fail when it is out of date
 *
 * scripts/mobile-routes.test.js runs the check in `pnpm test`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT = "src/shared/routes/mobile-routes.ts";
const PLATFORM = "mobile";

/** The module source for `registry`, formatted with the repository's Prettier config. */
export async function renderMobileRoutes(registry) {
  const routes = registry.routes
    .filter((route) => route.platform === PLATFORM)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((route) => ({
      id: route.id,
      path: route.path,
      params: route.params,
      shell: route.shell,
      surface: route.surface,
      parent: route.parent,
      nav: route.nav.type,
      status: route.status,
      session: route.access.session,
      capability: route.access.capability,
      phase: route.access.phase,
      restrictedAccount: route.access.restrictedAccount ?? false,
      ...(route.redirect ? { redirectTo: route.redirect.to } : {}),
    }));

  const shells = registry.shells
    .filter((shell) => shell.platform === PLATFORM)
    .map((shell) => ({
      id: shell.id,
      parent: shell.parent,
      navItems: (shell.navItems ?? []).map((item) => ({
        key: item.key,
        route: item.route,
        ...(item.query ? { query: item.query } : {}),
      })),
    }));

  const { guards } = registry;
  const mobileGuards = {
    signIn: guards.signIn[PLATFORM],
    entry: guards.entry[PLATFORM],
    notFound: guards.notFound[PLATFORM],
    accountOnboarding: guards.accountOnboarding[PLATFORM],
    workspaceChooser: guards.workspaceChooser[PLATFORM],
    defaultDestinationFallback: guards.defaultDestinationFallback[PLATFORM],
    restrictedAccount: {
      suspended: guards.restrictedAccount.suspended[PLATFORM],
      pendingDeletion: guards.restrictedAccount.pendingDeletion[PLATFORM],
    },
    returnToParam: guards.returnToParam,
  };

  const capabilities = Object.fromEntries(
    Object.entries(registry.capabilities).map(([name, capability]) => [
      name,
      { home: capability.home[PLATFORM], onboarding: capability.onboarding[PLATFORM] },
    ]),
  );

  const json = (value) => JSON.stringify(value, null, 2);

  const source = `// Generated from docs/route-registry.json by scripts/generate-mobile-routes.mjs.
// Do not edit: change the registry (SF-31) and run \`pnpm routes:generate\`.

export const mobileRoutes = ${json(routes)} as const;

export const mobileShells = ${json(shells)} as const;

export const mobileGuards = ${json(mobileGuards)} as const;

export const mobileCapabilities = ${json(capabilities)} as const;
`;
  const target = join(root, OUTPUT);
  return prettier.format(source, { ...(await prettier.resolveConfig(target)), filepath: target });
}

async function main() {
  const registry = JSON.parse(readFileSync(join(root, "docs/route-registry.json"), "utf8"));
  const content = await renderMobileRoutes(registry);
  const target = join(root, OUTPUT);

  if (process.argv.includes("--check")) {
    const current = readFileSync(target, "utf8");
    if (current !== content) {
      console.error(`${OUTPUT} is out of date: run pnpm routes:generate`);
      process.exit(1);
    }
    console.log(`${OUTPUT} is up to date with docs/route-registry.json.`);
    return;
  }

  writeFileSync(target, content);
  console.log(`Wrote ${OUTPUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
