const { readFileSync, readdirSync } = require("node:fs");
const { dirname, join } = require("node:path");

/*
 * SF-34: the production system states of the Expo Router tree (static
 * checks; the router test renders them).
 */
const root = dirname(require.resolve("../package.json"));
const read = (path) => readFileSync(join(root, path), "utf8");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function* files(dir) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

describe("mobile system states", () => {
  it("+not-found renders the production 404 (ER1)", () => {
    expect(code("src/app/+not-found.tsx")).toContain("<NotFoundState />");
  });

  it("the root layout exports the error boundary, which never renders the error itself", () => {
    const layout = code("src/app/_layout.tsx");
    expect(layout).toMatch(/export function ErrorBoundary/);
    expect(layout).not.toMatch(/error\.(message|stack)|>\s*\{error\}/);
  });

  it("every gated shell covers its navigator with the launch screen while the session is restored", () => {
    const layouts = [...files("src/app")].filter(
      (file) => file.endsWith("_layout.tsx") && code(file).includes("<SessionGate"),
    );
    expect(layouts).toHaveLength(6);
    for (const file of layouts) {
      expect(code(file)).toContain("pending={<LaunchScreen />}");
      // SF-24: a network or server failure shows the retryable failure state, never a sign-out.
      expect(code(file)).toContain("unavailable={<SessionFailure />}");
    }
  });

  it("LD2 is not wired to any boundary until home loads real data", () => {
    const sources = [...files("src/app")].map((file) => code(file)).join("\n");
    expect(sources).not.toMatch(/LoadingBar|LoadingPill/);
  });

  it("system-state UI schedules no artificial delay", () => {
    for (const file of files("src/widgets/system-states/ui")) {
      if (file.includes(".test.")) continue;
      expect([file, /setTimeout|setInterval|sleep\(/.test(code(file))]).toEqual([file, false]);
    }
  });
});
