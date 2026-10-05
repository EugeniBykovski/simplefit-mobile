import { readFileSync } from "node:fs";
import { join } from "node:path";

import spec from "../../../docs/design-tokens.json";

import { palettes, rawPalette, themeVariables, tokenCssName, type SemanticColors } from "./tokens";

/*
 * The mobile implementation of the shared design-system contract
 * (docs/design-tokens.json, kept identical in simplefit-platform). These tests
 * keep tokens.ts, tailwind.config.js, fonts and Metro in lockstep with it, so
 * web and mobile share one design language.
 */

// tailwind.config.js is plain Node config; it exports its semantic colour names.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require("../../../tailwind.config.js");

type Scheme = "dark" | "light";
const specPalette: Record<string, string> = spec.palette;
const specSemantic = spec.semantic as Record<Scheme, Record<string, string>>;

/** "graphite-950" -> "graphite950", "surface-elevated" -> "surfaceElevated". */
function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) =>
    /\d/.test(char) ? char : char.toUpperCase(),
  );
}

/** WCAG 2.x relative luminance contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const color = (scheme: Scheme, token: string) =>
  palettes[scheme][camel(token) as keyof SemanticColors];

describe("design tokens", () => {
  it("matches the shared raw palette", () => {
    const expected = Object.fromEntries(
      Object.entries(specPalette).map(([name, value]) => [camel(name), value]),
    );
    expect(rawPalette).toEqual(expected);
  });

  it.each(["dark", "light"] as const)(
    "maps every semantic token of the contract in the %s theme",
    (scheme) => {
      for (const [token, paletteName] of Object.entries(specSemantic[scheme])) {
        expect(color(scheme, token)).toBe(specPalette[paletteName]);
      }
      // overlay is mobile-only: the scrim colour, opacity applied by components.
      expect(Object.keys(palettes[scheme]).sort()).toEqual(
        [...Object.keys(specSemantic[scheme]).map(camel), "overlay"].sort(),
      );
    },
  );

  it.each(["dark", "light"] as const)("meets WCAG AA text contrast in the %s theme", (scheme) => {
    const failing = spec.contrast.text
      .map(([fg, bg]) => [`${fg}/${bg}`, contrast(color(scheme, fg!), color(scheme, bg!))] as const)
      .filter(([, ratio]) => ratio < 4.5);
    expect(failing).toEqual([]);
    // Focus indicators and control boundaries: 3:1 (WCAG 1.4.11).
    for (const [fg, bg] of spec.contrast.nonText) {
      expect(contrast(color(scheme, fg!), color(scheme, bg!))).toBeGreaterThanOrEqual(3);
    }
  });

  it("exposes exactly the semantic tokens as Tailwind colours (no default palette)", () => {
    const tokens = Object.keys(palettes.dark) as (keyof SemanticColors)[];
    expect([...tailwindConfig.semanticColors].sort()).toEqual(tokens.map(tokenCssName).sort());
    const colors = tailwindConfig.theme.colors;
    expect(Object.keys(colors).sort()).toEqual(
      ["transparent", ...tailwindConfig.semanticColors].sort(),
    );
    for (const name of tailwindConfig.semanticColors) {
      expect(colors[name]).toBe(`rgb(var(--color-${name}) / <alpha-value>)`);
    }
  });

  it("uses hex colours so they convert to CSS variable channels", () => {
    for (const scheme of ["light", "dark"] as const) {
      for (const value of Object.values(palettes[scheme])) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(tokenCssName("surfaceElevated")).toBe("surface-elevated");
    expect(themeVariables("dark")).toBeDefined();
  });
});

describe("scales", () => {
  const { theme } = tailwindConfig;

  it("replaces the type scale with exactly the contract's roles", () => {
    const expected = Object.fromEntries(
      Object.entries(spec.typography.roles).map(([role, def]) => [
        role,
        [`${def.size}px`, `${def.lineHeight}px`],
      ]),
    );
    expect(theme.fontSize).toEqual(expected);
  });

  it("converts each role's tracking to px", () => {
    for (const [role, def] of Object.entries(spec.typography.roles)) {
      if (!def.tracking) continue;
      expect(theme.extend.letterSpacing[role]).toBe(`${+(def.size * def.tracking).toFixed(2)}px`);
    }
  });

  it("replaces the radius scale with the contract's", () => {
    const expected = Object.fromEntries(
      Object.entries(spec.radius).map(([name, px]) => [name, `${px}px`]),
    );
    expect(theme.borderRadius).toEqual({ none: "0px", ...expected, full: "9999px" });
  });

  it("has every spacing step at its canonical size (1 step = 4 px at 16 px per rem)", () => {
    // Steps outside the Tailwind default scale are added in px.
    expect(theme.extend.spacing).toEqual({ 4.5: "18px", 5.5: "22px" });
    // Metro renders 1 rem = 16 pt so the default steps keep their px value.
    const metro = readFileSync(join(__dirname, "../../../metro.config.js"), "utf8");
    expect(metro).toMatch(/inlineRem:\s*16\b/);
  });

  it("defines the canonical control heights and touch targets", () => {
    const button = spec.controls.button.mobile;
    expect(theme.extend.minHeight).toEqual({
      touch: "44px",
      "touch-gym": `${button.gym.height}px`,
      "button-sm": `${button.sm.height}px`,
      "button-md": `${button.md.height}px`,
      "button-lg": `${button.lg.height}px`,
      field: `${spec.controls.field.mobile.height}px`,
    });
  });
});
