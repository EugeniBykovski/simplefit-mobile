import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { REACT_NATIVE_PRELOAD } from "./react-native-preload";

/** Every source file under `dir`. */
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

it("preloads every React Native value the app imports", () => {
  const imported = new Set<string>();
  for (const file of sources(join(__dirname, ".."))) {
    const source = readFileSync(file, "utf8");
    for (const [, kind, names] of source.matchAll(
      /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"react-native"/g,
    )) {
      if (kind !== undefined || names === undefined) continue;
      for (const raw of names.split(",")) {
        const name = raw
          .trim()
          .split(/\s+as\s+/)[0]
          ?.trim();
        if (name && !name.startsWith("type ")) imported.add(name);
      }
    }
  }
  const preloaded: readonly string[] = REACT_NATIVE_PRELOAD;
  expect([...imported].filter((name) => !preloaded.includes(name)).sort()).toEqual([]);
});
