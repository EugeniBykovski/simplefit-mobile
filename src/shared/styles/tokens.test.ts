import { palettes, themeVariables, tokenCssName, type SemanticColors } from "./tokens";

// tailwind.config.js is plain Node config; it exports its semantic colour names.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require("../../../tailwind.config.js");

const tokens = Object.keys(palettes.light) as (keyof SemanticColors)[];

describe("design tokens", () => {
  it("defines the web token contract in light and dark", () => {
    expect(tokens).toEqual(
      expect.arrayContaining([
        "background",
        "foreground",
        "surface",
        "muted",
        "primary",
        "secondary",
        "accent",
        "success",
        "warning",
        "danger",
        "border",
      ]),
    );
    expect(Object.keys(palettes.dark)).toEqual(tokens);
  });

  it("exposes every palette token as a Tailwind colour class", () => {
    expect([...tailwindConfig.semanticColors].sort()).toEqual(tokens.map(tokenCssName).sort());
    for (const name of tailwindConfig.semanticColors) {
      expect(tailwindConfig.theme.extend.colors[name]).toBe(
        `rgb(var(--color-${name}) / <alpha-value>)`,
      );
    }
  });

  it("defines a 44pt minimum touch target utility", () => {
    expect(tailwindConfig.theme.extend.minHeight.touch).toBe("44px");
    expect(tailwindConfig.theme.extend.minWidth.touch).toBe("44px");
  });

  it("uses hex colours so they convert to CSS variable channels", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const value of Object.values(palettes[scheme])) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(tokenCssName("mutedForeground")).toBe("muted-foreground");
    expect(themeVariables("dark")).toBeDefined();
  });
});
