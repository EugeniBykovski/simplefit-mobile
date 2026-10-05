import spec from "../../docs/design-tokens.json";

import { appFonts } from "./fonts";

// tailwind.config.js is plain Node config.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require("../../tailwind.config.js");

/*
 * Bundled fonts are exactly the weights of the shared contract
 * (docs/design-tokens.json typography.weights), and every Tailwind font family
 * points at a bundled font, so no weight is synthesized or missing.
 */
const fileFamily = {
  display: "Unbounded",
  sans: "Manrope",
  mono: "JetBrainsMono",
} as const;

describe("app fonts", () => {
  it("bundles exactly the contract's weights per family", () => {
    const bundled = Object.keys(appFonts);
    const expected = Object.entries(spec.typography.weights).flatMap(([family, weights]) =>
      weights.map((weight) => `${fileFamily[family as keyof typeof fileFamily]}_${weight}`),
    );
    const bundledWeights = bundled.map((name) => name.replace(/^(\w+?)_(\d+).*$/, "$1_$2"));
    expect(bundledWeights.sort()).toEqual(expected.sort());
  });

  it("maps every Tailwind font family to a bundled font", () => {
    const { fontFamily } = tailwindConfig.theme.extend;
    for (const [name, [file]] of Object.entries(fontFamily) as [string, string[]][]) {
      if (name === "system") continue;
      expect(appFonts).toHaveProperty(file!);
    }
  });
});
